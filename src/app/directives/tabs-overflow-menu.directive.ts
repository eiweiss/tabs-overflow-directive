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
  private tabHeaderElement: HTMLElement | null = null;

  constructor() {
    console.log('TabsOverflowMenuDirective constructor called');
    // React to overflow changes using Angular signals
    effect(() => {
      const hasOverflow = this.tabsOverflow.hasOverflow();
      const allTabs = this.tabsOverflow.allTabs();

      console.log('TabsOverflowMenuDirective effect triggered:', {
        hasOverflow,
        allTabsCount: allTabs.length,
      });

      if (hasOverflow && allTabs.length > 0) {
        console.log('Showing menu with tabs:', allTabs);
        this.showMenu(allTabs);
        this.hidePaginationButtons();
      } else {
        console.log('Hiding menu (no overflow or no tabs)');
        this.hideMenu();
        this.showPaginationButtons();
      }
    });
  }

  ngAfterViewInit(): void {
    // Find tab header element
    setTimeout(() => {
      this.tabHeaderElement = this.elementRef.nativeElement.querySelector(
        '.mat-mdc-tab-header, .mat-tab-header'
      );
    }, 150);
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
    console.log('createMenu called, tabHeaderElement:', this.tabHeaderElement);
    if (!this.tabHeaderElement) {
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
    const paginationContainer = this.tabHeaderElement.querySelector(
      '.mat-mdc-tab-header-pagination-after, .mat-tab-header-pagination-after'
    );

    if (paginationContainer) {
      this.renderer.insertBefore(
        this.tabHeaderElement,
        menuElement,
        paginationContainer
      );
    } else {
      this.renderer.appendChild(this.tabHeaderElement, menuElement);
    }
  }

  private destroyMenu(): void {
    if (this.menuComponentRef) {
      this.appRef.detachView(this.menuComponentRef.hostView);
      this.menuComponentRef.destroy();
      this.menuComponentRef = null;
    }
  }

  private hidePaginationButtons(): void {
    if (!this.tabHeaderElement) return;
    const buttons = this.tabHeaderElement.querySelectorAll(
      '.mat-mdc-tab-header-pagination, .mat-tab-header-pagination'
    );
    buttons.forEach((btn) => {
      this.renderer.setStyle(btn, 'display', 'none');
    });
  }

  private showPaginationButtons(): void {
    if (!this.tabHeaderElement) return;
    const buttons = this.tabHeaderElement.querySelectorAll(
      '.mat-mdc-tab-header-pagination, .mat-tab-header-pagination'
    );
    buttons.forEach((btn) => {
      this.renderer.removeStyle(btn, 'display');
    });
  }
}
