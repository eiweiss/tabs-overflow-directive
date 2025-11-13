import {
  Directive,
  ElementRef,
  OnDestroy,
  AfterViewInit,
  Renderer2,
  inject,
  signal,
  effect,
} from '@angular/core';
import { MatTabNav } from '@angular/material/tabs';
import { Subject, fromEvent, merge, timer, Observable } from 'rxjs';
import {
  takeUntil,
  debounceTime,
  distinctUntilChanged,
  map,
  startWith,
} from 'rxjs/operators';

export interface TabInfo {
  label: string;
  index: number;
  element: HTMLElement;
}

/**
 * Directive that detects tab overflow and provides tab information.
 * Designed to be composed with other directives via hostDirectives.
 */
@Directive({
  selector: '[appTabsOverflow]',
  standalone: true,
  exportAs: 'tabsOverflow',
})
export class TabsOverflowDirective implements AfterViewInit, OnDestroy {
  private readonly elementRef = inject(ElementRef);
  private readonly matTabNav = inject(MatTabNav, { optional: true });
  private readonly destroy$ = new Subject<void>();

  // Reactive signals for state
  readonly hasOverflow = signal(false);
  readonly allTabs = signal<TabInfo[]>([]);
  readonly visibleTabs = signal<TabInfo[]>([]);
  readonly hiddenTabs = signal<TabInfo[]>([]);

  private tabHeaderElement: HTMLElement | null = null;

  ngAfterViewInit(): void {
    if (!this.matTabNav) {
      console.warn('TabsOverflowDirective requires MatTabNav parent');
      return;
    }

    // Wait for DOM to be fully rendered
    timer(100)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.initialize();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initialize(): void {
    this.tabHeaderElement = this.elementRef.nativeElement.querySelector(
      '.mat-mdc-tab-header, .mat-tab-header'
    );

    if (!this.tabHeaderElement) {
      console.warn('Could not find tab header element');
      return;
    }

    this.setupOverflowDetection();
  }

  private setupOverflowDetection(): void {
    if (!this.tabHeaderElement) return;

    // Observable for window resize
    const resize$ = fromEvent(window, 'resize').pipe(
      debounceTime(150),
      startWith(null)
    );

    // Observable for DOM mutations
    const mutation$ = new Observable<MutationRecord[]>((observer) => {
      const mutationObserver = new MutationObserver((mutations) => {
        observer.next(mutations);
      });

      mutationObserver.observe(this.tabHeaderElement!, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
      });

      return () => mutationObserver.disconnect();
    }).pipe(debounceTime(100));

    // Observable for periodic checks (for route changes)
    const periodic$ = timer(0, 500);

    // Combine all streams
    merge(resize$, mutation$, periodic$)
      .pipe(
        debounceTime(100),
        map(() => this.detectOverflow()),
        distinctUntilChanged(
          (prev, curr) =>
            prev.hasOverflow === curr.hasOverflow &&
            prev.allTabs.length === curr.allTabs.length
        ),
        takeUntil(this.destroy$)
      )
      .subscribe((state) => {
        this.hasOverflow.set(state.hasOverflow);
        this.allTabs.set(state.allTabs);
        this.visibleTabs.set(state.visibleTabs);
        this.hiddenTabs.set(state.hiddenTabs);
      });
  }

  private detectOverflow() {
    if (!this.tabHeaderElement) {
      return {
        hasOverflow: false,
        allTabs: [],
        visibleTabs: [],
        hiddenTabs: [],
      };
    }

    const tabListContainer = this.tabHeaderElement.querySelector(
      '.mat-mdc-tab-list, .mat-tab-list'
    ) as HTMLElement;

    const tabElements = Array.from(
      this.tabHeaderElement.querySelectorAll(
        '.mat-mdc-tab-link, .mat-tab-link'
      )
    ) as HTMLElement[];

    if (!tabListContainer || tabElements.length === 0) {
      return {
        hasOverflow: false,
        allTabs: [],
        visibleTabs: [],
        hiddenTabs: [],
      };
    }

    // Check for pagination buttons (indicates overflow)
    const paginationBefore = this.tabHeaderElement.querySelector(
      '.mat-mdc-tab-header-pagination-before:not(.mat-mdc-tab-header-pagination-disabled)'
    );
    const paginationAfter = this.tabHeaderElement.querySelector(
      '.mat-mdc-tab-header-pagination-after:not(.mat-mdc-tab-header-pagination-disabled)'
    );
    const hasPagination = !!(paginationBefore || paginationAfter);

    const containerRect = tabListContainer.getBoundingClientRect();
    const allTabs: TabInfo[] = [];
    const visibleTabs: TabInfo[] = [];
    const hiddenTabs: TabInfo[] = [];

    tabElements.forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      const labelElement = element.querySelector(
        '.mat-mdc-tab-link-content, .mat-tab-label-content'
      );
      const label = labelElement?.textContent?.trim() || `Tab ${index + 1}`;

      const tabInfo: TabInfo = { label, index, element };
      allTabs.push(tabInfo);

      // Check if tab is visible within container bounds
      const isVisible =
        rect.left >= containerRect.left - 10 &&
        rect.right <= containerRect.right + 10;

      if (isVisible && !hasPagination) {
        visibleTabs.push(tabInfo);
      } else {
        if (!hasPagination) {
          visibleTabs.push(tabInfo);
        } else {
          // With pagination, need to check more carefully
          if (isVisible) {
            visibleTabs.push(tabInfo);
          } else {
            hiddenTabs.push(tabInfo);
          }
        }
      }
    });

    return {
      hasOverflow: hasPagination,
      allTabs,
      visibleTabs,
      hiddenTabs,
    };
  }

  /**
   * Navigate to a specific tab by index
   */
  navigateToTab(index: number): void {
    const tabElements = this.tabHeaderElement?.querySelectorAll(
      '.mat-mdc-tab-link, .mat-tab-link'
    );
    if (tabElements && tabElements[index]) {
      (tabElements[index] as HTMLElement).click();
    }
  }
}
