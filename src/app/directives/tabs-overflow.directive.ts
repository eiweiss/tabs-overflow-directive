import {
  Directive,
  ElementRef,
  OnDestroy,
  AfterViewInit,
  Renderer2,
  inject,
  ComponentRef,
  createComponent,
  EnvironmentInjector,
  ApplicationRef,
} from '@angular/core';
import { MatTabGroup, MatTabNav } from '@angular/material/tabs';
import { Subject, fromEvent, merge, Observable, timer } from 'rxjs';
import {
  takeUntil,
  debounceTime,
  distinctUntilChanged,
  map,
  startWith,
  delay,
} from 'rxjs/operators';
import { OverflowMenuComponent } from './overflow-menu.component';

/**
 * Directive that injects a dropdown menu in the tab header
 * when there are more tabs than can be displayed.
 * The dropdown replaces the pagination arrows and updates
 * reactively on every tab change.
 */
@Directive({
  selector: '[appTabsOverflow]',
  standalone: true,
})
export class TabsOverflowDirective implements AfterViewInit, OnDestroy {
  private readonly elementRef = inject(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly injector = inject(EnvironmentInjector);
  private readonly appRef = inject(ApplicationRef);
  private readonly matTabGroup = inject(MatTabGroup, { optional: true });
  private readonly matTabNav = inject(MatTabNav, { optional: true });

  private readonly destroy$ = new Subject<void>();
  private menuComponentRef: ComponentRef<OverflowMenuComponent> | null = null;

  private tabHeaderElement: HTMLElement | null = null;
  private paginationElement: HTMLElement | null = null;

  ngAfterViewInit(): void {
    const tabGroupOrNav = this.matTabGroup || this.matTabNav;
    if (!tabGroupOrNav) {
      console.warn(
        'TabsOverflowDirective requires MatTabGroup or MatTabNav parent'
      );
      return;
    }

    // Use timer to ensure the DOM is fully rendered
    timer(100)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.initializeDirective();
      });
  }

  private initializeDirective(): void {
    // Find the tab header container
    this.tabHeaderElement = this.elementRef.nativeElement.querySelector(
      '.mat-mdc-tab-header, .mat-tab-header'
    );

    if (!this.tabHeaderElement) {
      console.warn('Could not find tab header element');
      return;
    }

    console.log('Tab header element found:', this.tabHeaderElement);

    // Find pagination element
    this.paginationElement = this.tabHeaderElement.querySelector(
      '.mat-mdc-tab-header-pagination-after, .mat-tab-header-pagination-after'
    );

    console.log('Pagination element found:', this.paginationElement);

    // Set up reactive overflow detection
    this.setupOverflowDetection();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.destroyMenuComponent();
  }

  /**
   * Sets up reactive overflow detection using RxJS
   */
  private setupOverflowDetection(): void {
    if (!this.tabHeaderElement) return;

    // Create observables for various events that might affect overflow
    const resize$ = fromEvent(window, 'resize').pipe(
      debounceTime(150),
      startWith(null)
    );

    // Tab selection changes (for MatTabGroup)
    const tabChange$ = this.matTabGroup?.selectedIndexChange.pipe(
      startWith(this.matTabGroup.selectedIndex)
    ) || new Subject<number>();

    // Route changes for MatTabNav
    const routeChange$ = timer(0, 500).pipe(
      takeUntil(this.destroy$),
      startWith(0)
    );

    // Mutation observer for DOM changes (tabs added/removed)
    const mutation$ = new Observable<MutationRecord[]>((observer) => {
      const mutationObserver = new MutationObserver((mutations) => {
        observer.next(mutations);
      });

      mutationObserver.observe(this.tabHeaderElement!, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class'],
      });

      return () => mutationObserver.disconnect();
    }).pipe(debounceTime(100));

    // Combine all observables
    merge(resize$, tabChange$, mutation$, routeChange$)
      .pipe(
        debounceTime(100),
        map(() => this.checkOverflow()),
        distinctUntilChanged(
          (prev, curr) =>
            prev.hasOverflow === curr.hasOverflow &&
            prev.hiddenTabs.length === curr.hiddenTabs.length
        ),
        takeUntil(this.destroy$)
      )
      .subscribe((overflowState) => {
        console.log('Overflow state:', overflowState);
        this.updateOverflowMenu(overflowState);
      });
  }

  /**
   * Checks if there are overflowing tabs
   */
  private checkOverflow(): {
    hasOverflow: boolean;
    hiddenTabs: Array<{ label: string; index: number }>;
    visibleTabs: Array<{ label: string; index: number }>;
  } {
    if (!this.tabHeaderElement) {
      return { hasOverflow: false, hiddenTabs: [], visibleTabs: [] };
    }

    const tabListContainer = this.tabHeaderElement.querySelector(
      '.mat-mdc-tab-list, .mat-tab-list'
    ) as HTMLElement;

    const tabLabels = Array.from(
      this.tabHeaderElement.querySelectorAll(
        '.mat-mdc-tab-link, .mat-mdc-tab, .mat-tab-link, .mat-tab'
      )
    ) as HTMLElement[];

    console.log('Tab list container:', tabListContainer);
    console.log('Found tabs:', tabLabels.length);

    if (!tabListContainer || tabLabels.length === 0) {
      return { hasOverflow: false, hiddenTabs: [], visibleTabs: [] };
    }

    const containerRect = tabListContainer.getBoundingClientRect();
    const hiddenTabs: Array<{ label: string; index: number }> = [];
    const visibleTabs: Array<{ label: string; index: number }> = [];

    // Check if pagination buttons are visible (indicates overflow)
    const hasPaginationButtons = this.tabHeaderElement.querySelector(
      '.mat-mdc-tab-header-pagination-disabled, .mat-tab-header-pagination-disabled'
    ) === null;

    console.log('Has pagination buttons:', hasPaginationButtons);

    tabLabels.forEach((tab, index) => {
      const tabRect = tab.getBoundingClientRect();
      const labelElement = tab.querySelector(
        '.mat-mdc-tab-link-content, .mdc-tab__content, .mat-tab-label-content'
      );
      const label = labelElement?.textContent?.trim() || `Tab ${index + 1}`;

      // Check if tab is outside the visible container or if we have pagination
      const isHidden =
        tabRect.right > containerRect.right + 50 ||
        tabRect.left < containerRect.left - 50 ||
        (hasPaginationButtons && index >= Math.floor(tabLabels.length / 2));

      if (isHidden) {
        hiddenTabs.push({ label, index });
      } else {
        visibleTabs.push({ label, index });
      }
    });

    // If we have pagination buttons, we definitely have overflow
    const hasOverflow = hasPaginationButtons || hiddenTabs.length > 0;

    return {
      hasOverflow,
      hiddenTabs,
      visibleTabs,
    };
  }

  /**
   * Updates or creates/destroys the overflow menu based on state
   */
  private updateOverflowMenu(overflowState: {
    hasOverflow: boolean;
    hiddenTabs: Array<{ label: string; index: number }>;
    visibleTabs: Array<{ label: string; index: number }>;
  }): void {
    if (overflowState.hasOverflow) {
      // Show menu with all tabs
      if (!this.menuComponentRef) {
        this.createMenuComponent();
      }

      if (this.menuComponentRef) {
        // Show all tabs in the menu when there's overflow
        const allTabs = [
          ...overflowState.visibleTabs,
          ...overflowState.hiddenTabs,
        ];
        this.menuComponentRef.instance.updateTabs(allTabs, []);
      }

      // Hide pagination buttons
      this.hidePaginationButtons();
    } else {
      // No overflow - destroy menu and show pagination
      this.destroyMenuComponent();
      this.showPaginationButtons();
    }
  }

  /**
   * Creates the overflow menu component and injects it into the DOM
   */
  private createMenuComponent(): void {
    if (!this.tabHeaderElement) return;

    console.log('Creating menu component');

    // Create the component
    this.menuComponentRef = createComponent(OverflowMenuComponent, {
      environmentInjector: this.injector,
    });

    // Set up tab selection handler
    this.menuComponentRef.instance.tabSelected
      .pipe(takeUntil(this.destroy$))
      .subscribe((index: number) => {
        console.log('Tab selected:', index);
        this.selectTab(index);
      });

    // Attach to application
    this.appRef.attachView(this.menuComponentRef.hostView);

    // Get the menu element
    const menuElement = (this.menuComponentRef.hostView as any)
      .rootNodes[0] as HTMLElement;

    // Add some styling to position it correctly
    this.renderer.setStyle(menuElement, 'margin-left', 'auto');
    this.renderer.setStyle(menuElement, 'margin-right', '8px');

    // Find the pagination container or insert at the end of tab header
    const paginationContainer = this.tabHeaderElement.querySelector(
      '.mat-mdc-tab-header-pagination-after, .mat-tab-header-pagination-after'
    );

    if (paginationContainer) {
      // Insert before pagination
      this.renderer.insertBefore(
        this.tabHeaderElement,
        menuElement,
        paginationContainer
      );
    } else {
      // Append to the end
      this.renderer.appendChild(this.tabHeaderElement, menuElement);
    }

    console.log('Menu component created and inserted');
  }

  /**
   * Destroys the menu component
   */
  private destroyMenuComponent(): void {
    if (this.menuComponentRef) {
      console.log('Destroying menu component');
      this.appRef.detachView(this.menuComponentRef.hostView);
      this.menuComponentRef.destroy();
      this.menuComponentRef = null;
    }
  }

  /**
   * Hides the pagination buttons
   */
  private hidePaginationButtons(): void {
    const paginationButtons = this.tabHeaderElement?.querySelectorAll(
      '.mat-mdc-tab-header-pagination, .mat-tab-header-pagination'
    );
    paginationButtons?.forEach((button) => {
      this.renderer.setStyle(button, 'display', 'none');
    });
  }

  /**
   * Shows the pagination buttons
   */
  private showPaginationButtons(): void {
    const paginationButtons = this.tabHeaderElement?.querySelectorAll(
      '.mat-mdc-tab-header-pagination, .mat-tab-header-pagination'
    );
    paginationButtons?.forEach((button) => {
      this.renderer.removeStyle(button, 'display');
    });
  }

  /**
   * Selects a tab by index
   */
  private selectTab(index: number): void {
    if (this.matTabGroup) {
      this.matTabGroup.selectedIndex = index;
    } else if (this.matTabNav) {
      // For MatTabNav, we need to find and click the tab link
      const tabLinks = this.tabHeaderElement?.querySelectorAll(
        '.mat-mdc-tab-link, .mat-tab-link'
      );
      if (tabLinks && tabLinks[index]) {
        (tabLinks[index] as HTMLElement).click();
      }
    }
  }
}
