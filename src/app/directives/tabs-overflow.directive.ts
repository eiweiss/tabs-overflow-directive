import {
  Directive,
  ElementRef,
  OnDestroy,
  AfterViewInit,
  inject,
  signal,
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

  private _tabHeaderElement: HTMLElement | null = null;
  private visibleTabIndices: number[] = [];
  private maxVisibleTabs = 0;
  private isInitialized = false;
  private mutationObserver: MutationObserver | null = null;
  private isUpdating = false;

  /**
   * Public getter for tab header element
   * Used by composed directives
   */
  get tabHeaderElement(): HTMLElement | null {
    return this._tabHeaderElement;
  }

  ngAfterViewInit(): void {
    if (!this.matTabNav) {
      console.warn('TabsOverflowDirective requires MatTabNav parent');
      return;
    }

    // Wait for DOM to be fully rendered and painted
    // Use longer delay and requestAnimationFrame for better timing
    timer(0)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.initialize();
          });
        });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.mutationObserver?.disconnect();
  }

  private initialize(): void {
    // Try multiple approaches to find the tab header
    const nativeElement = this.elementRef.nativeElement as HTMLElement;

    // Approach 1: Look for tab header as direct child
    this._tabHeaderElement = nativeElement.querySelector(
      '.mat-mdc-tab-header, .mat-tab-header'
    );

    // Approach 2: Use the native element itself if it has the right class
    if (!this._tabHeaderElement) {
      if (
        nativeElement.classList.contains('mat-mdc-tab-header') ||
        nativeElement.classList.contains('mat-tab-header')
      ) {
        this._tabHeaderElement = nativeElement;
      }
    }

    // Approach 3: Access via MatTabNav's internal _tabHeader
    if (!this._tabHeaderElement && this.matTabNav) {
      const tabNav = this.matTabNav as any;
      if (tabNav._tabHeader && tabNav._tabHeader._elementRef) {
        this._tabHeaderElement = tabNav._tabHeader._elementRef.nativeElement;
      }
    }

    // Approach 4: Look in the entire element tree
    if (!this._tabHeaderElement) {
      const allElements = nativeElement.querySelectorAll('*');
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i] as HTMLElement;
        if (
          el.classList.contains('mat-mdc-tab-header') ||
          el.classList.contains('mat-tab-header')
        ) {
          this._tabHeaderElement = el;
          break;
        }
      }
    }

    if (!this._tabHeaderElement) {
      console.warn('TabsOverflowDirective: Could not find tab header element');
      return;
    }

    this.setupOverflowDetection();
  }

  private setupOverflowDetection(): void {
    if (!this._tabHeaderElement) return;

    // Observable for window resize
    const resize$ = fromEvent(window, 'resize').pipe(
      debounceTime(150),
      startWith(null)
    );

    // Observable for DOM mutations (only for tab additions/removals, not our own changes)
    const mutation$ = new Observable<MutationRecord[]>((observer) => {
      this.mutationObserver = new MutationObserver((mutations) => {
        // Ignore mutations while we're updating
        if (this.isUpdating) return;

        // Only react to meaningful changes (tab additions/removals)
        const hasRelevantChanges = mutations.some(mutation => {
          return mutation.type === 'childList' &&
                 Array.from(mutation.addedNodes).some(node =>
                   (node as HTMLElement).classList?.contains('mat-mdc-tab-link') ||
                   (node as HTMLElement).classList?.contains('mat-tab-link')
                 ) ||
                 Array.from(mutation.removedNodes).some(node =>
                   (node as HTMLElement).classList?.contains('mat-mdc-tab-link') ||
                   (node as HTMLElement).classList?.contains('mat-tab-link')
                 );
        });

        if (hasRelevantChanges) {
          observer.next(mutations);
        }
      });

      this.mutationObserver.observe(this._tabHeaderElement!, {
        childList: true,
        subtree: false, // Only direct children, not subtree
      });

      return () => this.mutationObserver?.disconnect();
    }).pipe(debounceTime(200));

    // Combine streams (removed periodic timer to avoid constant updates)
    merge(resize$, mutation$)
      .pipe(
        debounceTime(150),
        map(() => {
          if (this.isUpdating) return null;
          // Always reset scroll position before detection
          this.resetScrollPosition();
          return this.detectOverflow();
        }),
        distinctUntilChanged(
          (prev, curr) => {
            if (!prev || !curr) return true;
            return prev.hasOverflow === curr.hasOverflow &&
              prev.allTabs.length === curr.allTabs.length &&
              prev.visibleTabs.length === curr.visibleTabs.length;
          }
        ),
        takeUntil(this.destroy$)
      )
      .subscribe((state) => {
        if (!state) return;
        this.updateState(state);
        // Reset scroll position after state update to ensure no scrolling
        setTimeout(() => this.resetScrollPosition(), 10);
      });
  }

  private detectOverflow() {
    if (!this._tabHeaderElement) {
      return {
        hasOverflow: false,
        allTabs: [],
        visibleTabs: [],
        hiddenTabs: [],
      };
    }

    const tabListContainer = this._tabHeaderElement.querySelector(
      '.mat-mdc-tab-list, .mat-tab-list'
    ) as HTMLElement;

    const tabElements = Array.from(
      this._tabHeaderElement.querySelectorAll(
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

    // Build tab info array
    const allTabs: TabInfo[] = tabElements.map((element, index) => {
      // Try multiple approaches to get the label
      let label = '';

      // Approach 1: Look for content wrapper
      const labelElement = element.querySelector(
        '.mat-mdc-tab-link-content, .mat-tab-label-content'
      );
      if (labelElement) {
        label = labelElement.textContent?.trim() || '';
      }

      // Approach 2: Get directly from element if no wrapper found
      if (!label) {
        label = element.textContent?.trim() || '';
      }

      // Fallback
      if (!label) {
        label = `Tab ${index + 1}`;
      }

      return { label, index, element };
    });

    // Calculate container width - always reserve space for menu button
    const containerWidth = tabListContainer.getBoundingClientRect().width;
    const menuButtonWidth = 56; // Always reserve space for overflow menu button
    const availableWidth = containerWidth - menuButtonWidth;

    // On first run, ensure all tabs are clickable and visible for measurement
    if (!this.isInitialized) {
      tabElements.forEach(el => {
        el.style.display = '';
        el.style.pointerEvents = 'auto';
        el.style.visibility = 'visible';
      });

      // Initial calculation: measure tabs in natural order
      let cumulativeWidth = 0;
      let fittingTabCount = 0;

      for (let i = 0; i < tabElements.length; i++) {
        const tabWidth = tabElements[i].getBoundingClientRect().width;
        if (cumulativeWidth + tabWidth <= availableWidth) {
          cumulativeWidth += tabWidth;
          fittingTabCount++;
        } else {
          break;
        }
      }

      this.maxVisibleTabs = Math.max(1, fittingTabCount);
      this.visibleTabIndices = allTabs.slice(0, this.maxVisibleTabs).map(t => t.index);
      this.isInitialized = true;
    } else {
      // After initialization: validate current visible tabs fit in available space
      // Measure width of currently visible tabs
      let cumulativeWidth = 0;
      const visibleTabElements = this.visibleTabIndices
        .map(idx => allTabs.find(t => t.index === idx))
        .filter(t => t !== undefined) as TabInfo[];

      for (const tabInfo of visibleTabElements) {
        const tabWidth = tabInfo.element.getBoundingClientRect().width;
        cumulativeWidth += tabWidth;
      }

      // If current visible tabs don't fit, remove from the end (right side) until they fit
      while (cumulativeWidth > availableWidth && this.visibleTabIndices.length > 1) {
        const removedIndex = this.visibleTabIndices.pop()!;
        const removedTab = allTabs.find(t => t.index === removedIndex);
        if (removedTab) {
          const removedWidth = removedTab.element.getBoundingClientRect().width;
          cumulativeWidth -= removedWidth;
        }
      }

      // Update maxVisibleTabs to match current visible count
      this.maxVisibleTabs = Math.max(1, this.visibleTabIndices.length);
    }

    const hasOverflow = allTabs.length > this.maxVisibleTabs;

    // Split tabs into visible and hidden based on indices
    const visibleTabs: TabInfo[] = [];
    const hiddenTabs: TabInfo[] = [];

    allTabs.forEach((tabInfo) => {
      const shouldBeVisible = this.visibleTabIndices.includes(tabInfo.index);

      if (shouldBeVisible && visibleTabs.length < this.maxVisibleTabs) {
        visibleTabs.push(tabInfo);
        tabInfo.element.style.display = '';
        tabInfo.element.style.pointerEvents = 'auto';
        tabInfo.element.style.visibility = 'visible';
        tabInfo.element.classList.remove('tab-overflow-hidden');
      } else {
        hiddenTabs.push(tabInfo);
        tabInfo.element.style.display = 'none';
        tabInfo.element.style.pointerEvents = 'none';
        tabInfo.element.style.visibility = 'hidden';
        tabInfo.element.classList.add('tab-overflow-hidden');
      }
    });

    return {
      hasOverflow,
      allTabs,
      visibleTabs,
      hiddenTabs,
    };
  }

  /**
   * Update state with isUpdating flag to prevent mutation loop
   */
  private updateState(state: { hasOverflow: boolean; allTabs: TabInfo[]; visibleTabs: TabInfo[]; hiddenTabs: TabInfo[] }): void {
    this.isUpdating = true;
    try {
      this.hasOverflow.set(state.hasOverflow);
      this.allTabs.set(state.allTabs);
      this.visibleTabs.set(state.visibleTabs);
      this.hiddenTabs.set(state.hiddenTabs);
    } finally {
      // Reset flag after a short delay to allow DOM to settle
      setTimeout(() => {
        this.isUpdating = false;
      }, 50);
    }
  }

  /**
   * Make a tab visible when selected from dropdown
   * Removes the rightmost visible tab and adds the selected tab to the right
   */
  makeTabVisible(selectedIndex: number): void {
    // If the tab is already visible, just navigate
    if (this.visibleTabIndices.includes(selectedIndex)) {
      this.navigateToTab(selectedIndex);
      return;
    }

    // Remove the last (rightmost) visible tab and add the selected tab to the right
    // This maintains left-to-right order and keeps leftmost tabs stable
    if (this.visibleTabIndices.length > 0) {
      this.visibleTabIndices.pop(); // Remove from right side instead of left
    }

    // Add the selected tab to the right
    this.visibleTabIndices.push(selectedIndex);

    // Reset scroll position before re-detection
    this.resetScrollPosition();

    // Trigger re-detection to apply visibility changes and validate fit
    const state = this.detectOverflow();
    this.updateState(state);

    // Navigate to the selected tab
    this.navigateToTab(selectedIndex);

    // Final scroll position reset after everything settles
    setTimeout(() => this.resetScrollPosition(), 100);
  }

  /**
   * Navigate to a specific tab by index
   */
  navigateToTab(index: number): void {
    const tabElements = this._tabHeaderElement?.querySelectorAll(
      '.mat-mdc-tab-link, .mat-tab-link'
    );
    if (tabElements && tabElements[index]) {
      (tabElements[index] as HTMLElement).click();

      // Prevent Angular Material from scrolling the tab list
      // Reset any scroll position that Material might have applied
      setTimeout(() => {
        this.resetScrollPosition();
      }, 0);
    }
  }

  /**
   * Reset scroll position to prevent Material's auto-scroll behavior
   */
  private resetScrollPosition(): void {
    if (!this._tabHeaderElement) return;

    // Reset scroll on the tab list container
    const tabListContainer = this._tabHeaderElement.querySelector(
      '.mat-mdc-tab-list-container, .mat-tab-list-container'
    ) as HTMLElement;

    if (tabListContainer) {
      tabListContainer.scrollLeft = 0;
    }

    // Reset transform on tab list and all potential scroll containers
    const scrollContainers = [
      '.mat-mdc-tab-list',
      '.mat-tab-list',
      '.mat-mdc-tab-labels',
      '.mat-tab-labels',
      '.mat-mdc-tab-header-pagination-controls-enabled'
    ];

    scrollContainers.forEach(selector => {
      const element = this._tabHeaderElement!.querySelector(selector) as HTMLElement;
      if (element) {
        element.style.transform = 'translateX(0px)';
        if (element.scrollLeft !== undefined) {
          element.scrollLeft = 0;
        }
      }
    });

    // Reset scrollDistance on MatTabNav if accessible
    if (this.matTabNav) {
      if ('_scrollDistance' in this.matTabNav) {
        (this.matTabNav as any)._scrollDistance = 0;
      }
      // Trigger change detection to update the view
      if ('updatePagination' in this.matTabNav && typeof (this.matTabNav as any).updatePagination === 'function') {
        try {
          (this.matTabNav as any).updatePagination();
        } catch (e) {
          // Ignore if method doesn't exist or fails
        }
      }
    }
  }
}
