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

    // Wait for DOM to be fully rendered with longer delay
    timer(300)
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
      console.warn('Could not find tab header element');
      console.log('Native element:', nativeElement);
      console.log('Children:', nativeElement.children);
      return;
    }

    console.log('Tab header found:', this._tabHeaderElement);
    this.setupOverflowDetection();
  }

  private setupOverflowDetection(): void {
    if (!this._tabHeaderElement) return;

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

      mutationObserver.observe(this._tabHeaderElement!, {
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

    console.log('detectOverflow - tabListContainer:', tabListContainer);
    console.log('detectOverflow - found tabs:', tabElements.length);

    if (!tabListContainer || tabElements.length === 0) {
      console.warn('No tab list container or tabs found');
      return {
        hasOverflow: false,
        allTabs: [],
        visibleTabs: [],
        hiddenTabs: [],
      };
    }

    // Calculate how many tabs can fit in the available space
    const containerWidth = tabListContainer.getBoundingClientRect().width;
    const menuButtonWidth = 48; // Reserve space for overflow menu button
    const availableWidth = containerWidth - menuButtonWidth;

    const allTabs: TabInfo[] = [];
    const visibleTabs: TabInfo[] = [];
    const hiddenTabs: TabInfo[] = [];

    let cumulativeWidth = 0;
    let fittingTabCount = 0;

    tabElements.forEach((element, index) => {
      const labelElement = element.querySelector(
        '.mat-mdc-tab-link-content, .mat-tab-label-content'
      );
      const label = labelElement?.textContent?.trim() || `Tab ${index + 1}`;
      const tabInfo: TabInfo = { label, index, element };
      allTabs.push(tabInfo);

      const tabWidth = element.getBoundingClientRect().width;

      // Calculate if this tab would fit
      if (cumulativeWidth + tabWidth <= availableWidth) {
        cumulativeWidth += tabWidth;
        fittingTabCount++;
      }
    });

    this.maxVisibleTabs = Math.max(1, fittingTabCount); // At least 1 tab visible
    const hasOverflow = allTabs.length > this.maxVisibleTabs;

    console.log('Calculated fitting tabs:', {
      containerWidth,
      availableWidth,
      maxVisibleTabs: this.maxVisibleTabs,
      totalTabs: allTabs.length,
      hasOverflow
    });

    // Initialize visible tab indices if not set
    if (this.visibleTabIndices.length === 0) {
      this.visibleTabIndices = allTabs
        .slice(0, this.maxVisibleTabs)
        .map(t => t.index);
    }

    // Apply visibility based on visibleTabIndices
    allTabs.forEach(tabInfo => {
      const shouldBeVisible = this.visibleTabIndices.includes(tabInfo.index);

      if (shouldBeVisible) {
        visibleTabs.push(tabInfo);
        tabInfo.element.style.display = '';
        tabInfo.element.classList.remove('tab-overflow-hidden');
      } else {
        hiddenTabs.push(tabInfo);
        tabInfo.element.style.display = 'none';
        tabInfo.element.classList.add('tab-overflow-hidden');
      }
    });

    const result = {
      hasOverflow,
      allTabs,
      visibleTabs,
      hiddenTabs,
    };

    console.log('Overflow detection result:', {
      hasOverflow: result.hasOverflow,
      totalTabs: result.allTabs.length,
      visibleCount: result.visibleTabs.length,
      hiddenCount: result.hiddenTabs.length,
      visibleIndices: this.visibleTabIndices,
    });

    return result;
  }

  /**
   * Make a tab visible when selected from dropdown
   * This will show the selected tab and hide the first visible tab to maintain space
   */
  makeTabVisible(selectedIndex: number): void {
    console.log('makeTabVisible called with index:', selectedIndex);

    // If the tab is already visible, just navigate
    if (this.visibleTabIndices.includes(selectedIndex)) {
      console.log('Tab already visible, just navigating');
      this.navigateToTab(selectedIndex);
      return;
    }

    // Remove the first visible tab and add the new one at the end
    if (this.visibleTabIndices.length >= this.maxVisibleTabs) {
      this.visibleTabIndices.shift(); // Remove first (oldest) visible tab
    }

    // Add the selected tab to visible tabs
    this.visibleTabIndices.push(selectedIndex);

    console.log('Updated visible tab indices:', this.visibleTabIndices);

    // Trigger re-detection to apply visibility changes
    const state = this.detectOverflow();
    this.hasOverflow.set(state.hasOverflow);
    this.allTabs.set(state.allTabs);
    this.visibleTabs.set(state.visibleTabs);
    this.hiddenTabs.set(state.hiddenTabs);

    // Navigate to the selected tab
    this.navigateToTab(selectedIndex);
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
    }
  }
}
