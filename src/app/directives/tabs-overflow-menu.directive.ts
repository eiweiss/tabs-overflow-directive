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
  effect,
} from '@angular/core';
import { TabsOverflowDirective } from './tabs-overflow.directive';
import { OverflowMenuComponent } from './overflow-menu.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

/**
 * Directive that renders an overflow menu for tabs.
 * Must be used together with TabsOverflowDirective.
 * Uses Angular's directive composition for clean architecture.
 */
@Directive({
  selector: '[appTabsOverflowMenu]',
  standalone: true,
  hostDirectives: [
    {
      directive: TabsOverflowDirective,
      inputs: [],
      outputs: [],
    },
  ],
})
export class TabsOverflowMenuDirective implements AfterViewInit, OnDestroy {
  private readonly elementRef = inject(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly injector = inject(EnvironmentInjector);
  private readonly appRef = inject(ApplicationRef);
  private readonly tabsOverflow = inject(TabsOverflowDirective);
  private readonly destroy$ = new Subject<void>();

  private menuComponentRef: ComponentRef<OverflowMenuComponent> | null = null;

  constructor() {
    console.log('TabsOverflowMenuDirective constructor called');
    // React to overflow changes using Angular signals
    effect(() => {
      const hasOverflow = this.tabsOverflow.hasOverflow();
      const allTabs = this.tabsOverflow.allTabs();
      const tabHeaderElement = this.tabsOverflow.tabHeaderElement;

      console.log('TabsOverflowMenuDirective effect triggered:', {
        hasOverflow,
        allTabsCount: allTabs.length,
        hasTabHeader: !!tabHeaderElement,
      });

      if (hasOverflow && allTabs.length > 0 && tabHeaderElement) {
        console.log('Showing menu with tabs:', allTabs);
        this.showMenu(allTabs);
        this.hidePaginationButtons();
      } else {
        console.log('Hiding menu (no overflow or no tabs or no header)');
        this.hideMenu();
        this.showPaginationButtons();
      }
    });
  }

  ngAfterViewInit(): void {
    // No need to find tab header element anymore - using shared one from TabsOverflowDirective
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.destroyMenu();
  }

  private showMenu(tabs: Array<{ label: string; index: number }>): void {
    console.log('showMenu called with tabs:', tabs.length);
    if (!this.menuComponentRef) {
      console.log('Creating new menu');
      this.createMenu();
    }

    if (this.menuComponentRef) {
      console.log('Updating menu tabs');
      this.menuComponentRef.instance.updateTabs(tabs, []);
    } else {
      console.warn('Menu component ref is null after createMenu()');
    }
  }

  private hideMenu(): void {
    console.log('hideMenu called');
    this.destroyMenu();
  }

  private createMenu(): void {
    const tabHeaderElement = this.tabsOverflow.tabHeaderElement;
    console.log('createMenu called, tabHeaderElement:', tabHeaderElement);
    if (!tabHeaderElement) {
      console.warn('Cannot create menu: tabHeaderElement not found yet');
      return;
    }

    // Create the component
    this.menuComponentRef = createComponent(OverflowMenuComponent, {
      environmentInjector: this.injector,
    });

    // Handle tab selection
    this.menuComponentRef.instance.tabSelected
      .pipe(takeUntil(this.destroy$))
      .subscribe((index: number) => {
        this.tabsOverflow.navigateToTab(index);
      });

    // Attach to application
    this.appRef.attachView(this.menuComponentRef.hostView);

    // Get the menu element
    const menuElement = (this.menuComponentRef.hostView as any)
      .rootNodes[0] as HTMLElement;

    // Style the menu
    this.renderer.setStyle(menuElement, 'margin-left', 'auto');
    this.renderer.setStyle(menuElement, 'display', 'flex');
    this.renderer.setStyle(menuElement, 'align-items', 'center');

    // Insert before pagination
    const paginationContainer = tabHeaderElement.querySelector(
      '.mat-mdc-tab-header-pagination-after, .mat-tab-header-pagination-after'
    );

    if (paginationContainer) {
      this.renderer.insertBefore(
        tabHeaderElement,
        menuElement,
        paginationContainer
      );
    } else {
      this.renderer.appendChild(tabHeaderElement, menuElement);
    }

    console.log('Menu component created and inserted into DOM');
  }

  private destroyMenu(): void {
    if (this.menuComponentRef) {
      this.appRef.detachView(this.menuComponentRef.hostView);
      this.menuComponentRef.destroy();
      this.menuComponentRef = null;
    }
  }

  private hidePaginationButtons(): void {
    const tabHeaderElement = this.tabsOverflow.tabHeaderElement;
    if (!tabHeaderElement) return;
    const buttons = tabHeaderElement.querySelectorAll(
      '.mat-mdc-tab-header-pagination, .mat-tab-header-pagination'
    );
    buttons.forEach((btn) => {
      this.renderer.setStyle(btn, 'display', 'none');
    });
    console.log('Pagination buttons hidden');
  }

  private showPaginationButtons(): void {
    const tabHeaderElement = this.tabsOverflow.tabHeaderElement;
    if (!tabHeaderElement) return;
    const buttons = tabHeaderElement.querySelectorAll(
      '.mat-mdc-tab-header-pagination, .mat-tab-header-pagination'
    );
    buttons.forEach((btn) => {
      this.renderer.removeStyle(btn, 'display');
    });
    console.log('Pagination buttons shown');
  }
}
