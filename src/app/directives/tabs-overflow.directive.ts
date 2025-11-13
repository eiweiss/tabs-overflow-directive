import {
  Directive,
  ElementRef,
  OnDestroy,
  AfterViewInit,
  Renderer2,
  inject,
  ViewContainerRef,
  ComponentRef,
  createComponent,
  EnvironmentInjector,
  ApplicationRef,
} from '@angular/core';
import { MatTabGroup, MatTabNav } from '@angular/material/tabs';
import { Subject, fromEvent, merge, Observable } from 'rxjs';
import {
  takeUntil,
  debounceTime,
  distinctUntilChanged,
  map,
  startWith,
  switchMap,
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

    // Find the tab header container
    this.tabHeaderElement = this.elementRef.nativeElement.querySelector(
      '.mat-mdc-tab-header'
    );

    if (!this.tabHeaderElement) {
      console.warn('Could not find tab header element');
      return;
    }

    // Find pagination element
    this.paginationElement = this.tabHeaderElement.querySelector(
      '.mat-mdc-tab-header-pagination'
    );

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

    // For MatTabNav, we'll use a simple subject since focusChange doesn't exist
    const focusChange$ = new Subject<void>();

    // Mutation observer for DOM changes (tabs added/removed)
    const mutation$ = new Observable<MutationRecord[]>((observer) => {
      const mutationObserver = new MutationObserver((mutations) => {
        observer.next(mutations);
      });

      mutationObserver.observe(this.tabHeaderElement!, {
        childList: true,
        subtree: true,
      });

      return () => mutationObserver.disconnect();
    }).pipe(debounceTime(100));

    // Combine all observables
    merge(resize$, tabChange$, focusChange$, mutation$)
      .pipe(
        debounceTime(50),
        map(() => this.checkOverflow()),
        distinctUntilChanged(
          (prev, curr) =>
            prev.hasOverflow === curr.hasOverflow &&
            prev.hiddenTabs.length === curr.hiddenTabs.length
        ),
        takeUntil(this.destroy$)
      )
      .subscribe((overflowState) => {
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
      '.mat-mdc-tab-list'
    ) as HTMLElement;
    const tabLabels = Array.from(
      this.tabHeaderElement.querySelectorAll('.mat-mdc-tab-link, .mat-mdc-tab')
    ) as HTMLElement[];

    if (!tabListContainer || tabLabels.length === 0) {
      return { hasOverflow: false, hiddenTabs: [], visibleTabs: [] };
    }

    const containerRect = tabListContainer.getBoundingClientRect();
    const hiddenTabs: Array<{ label: string; index: number }> = [];
    const visibleTabs: Array<{ label: string; index: number }> = [];

    tabLabels.forEach((tab, index) => {
      const tabRect = tab.getBoundingClientRect();
      const labelElement = tab.querySelector(
        '.mat-mdc-tab-link-content, .mdc-tab__content'
      );
      const label = labelElement?.textContent?.trim() || `Tab ${index + 1}`;

      // Check if tab is outside the visible container
      if (
        tabRect.right > containerRect.right ||
        tabRect.left < containerRect.left
      ) {
        hiddenTabs.push({ label, index });
      } else {
        visibleTabs.push({ label, index });
      }
    });

    return {
      hasOverflow: hiddenTabs.length > 0,
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
        this.menuComponentRef.instance.updateTabs(
          overflowState.visibleTabs,
          overflowState.hiddenTabs
        );
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
    if (!this.tabHeaderElement || !this.paginationElement) return;

    // Create the component
    this.menuComponentRef = createComponent(OverflowMenuComponent, {
      environmentInjector: this.injector,
    });

    // Set up tab selection handler
    this.menuComponentRef.instance.tabSelected
      .pipe(takeUntil(this.destroy$))
      .subscribe((index: number) => {
        this.selectTab(index);
      });

    // Attach to application
    this.appRef.attachView(this.menuComponentRef.hostView);

    // Insert before pagination
    const menuElement = (this.menuComponentRef.hostView as any)
      .rootNodes[0] as HTMLElement;
    this.renderer.insertBefore(
      this.tabHeaderElement,
      menuElement,
      this.paginationElement
    );
  }

  /**
   * Destroys the menu component
   */
  private destroyMenuComponent(): void {
    if (this.menuComponentRef) {
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
      '.mat-mdc-tab-header-pagination'
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
      '.mat-mdc-tab-header-pagination'
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
        '.mat-mdc-tab-link'
      );
      if (tabLinks && tabLinks[index]) {
        (tabLinks[index] as HTMLElement).click();
      }
    }
  }
}
