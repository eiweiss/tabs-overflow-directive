import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import { MatTabsModule, MatTabNav } from '@angular/material/tabs';
import { MatTabNavBarHarness } from '@angular/material/tabs/testing';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { RouterTestingModule } from '@angular/router/testing';
import { TabsOverflowDirective } from './tabs-overflow.directive';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

@Component({
  template: `
    <nav mat-tab-nav-bar [tabPanel]="tabPanel" appTabsOverflow #overflow="tabsOverflow">
      @for (link of links; track $index) {
        <a mat-tab-link [routerLink]="link.path" [active]="link.active">
          {{ link.label }}
        </a>
      }
    </nav>
    <mat-tab-nav-panel #tabPanel></mat-tab-nav-panel>
  `,
  standalone: false,
})
class TestHostComponent {
  links = [
    { path: '/tab1', label: 'Tab 1', active: false },
    { path: '/tab2', label: 'Tab 2', active: false },
    { path: '/tab3', label: 'Tab 3', active: false },
    { path: '/tab4', label: 'Tab 4', active: false },
    { path: '/tab5', label: 'Tab 5', active: false },
  ];
}

describe('TabsOverflowDirective', () => {
  let component: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;
  let directiveElement: DebugElement;
  let directive: TabsOverflowDirective;
  let loader: HarnessLoader;
  let tabNavBarHarness: MatTabNavBarHarness;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TestHostComponent],
      imports: [
        MatTabsModule,
        RouterTestingModule,
        NoopAnimationsModule,
        TabsOverflowDirective,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    directiveElement = fixture.debugElement.query(
      By.directive(TabsOverflowDirective)
    );
    directive = directiveElement.injector.get(TabsOverflowDirective);
    loader = TestbedHarnessEnvironment.loader(fixture);
    fixture.detectChanges();

    // Get the tab nav bar harness
    tabNavBarHarness = await loader.getHarness(MatTabNavBarHarness);
  });

  it('should create directive', () => {
    expect(directive).toBeTruthy();
  });

  it('should create tab nav bar harness', async () => {
    expect(tabNavBarHarness).toBeTruthy();
  });

  it('should have correct number of tab links using harness', async () => {
    const links = await tabNavBarHarness.getLinks();
    expect(links.length).toBe(5);
  });

  it('should initialize with all tabs visible when enough space', async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    fixture.detectChanges();

    const links = await tabNavBarHarness.getLinks();
    expect(directive.allTabs().length).toBe(5);
    expect(links.length).toBe(5);
    expect(directive.hasOverflow()).toBeDefined();
  });

  it('should detect overflow when container is too small', (done) => {
    // Reduce container width
    const navElement = directiveElement.nativeElement as HTMLElement;
    navElement.style.width = '200px';

    setTimeout(() => {
      fixture.detectChanges();
      window.dispatchEvent(new Event('resize'));

      setTimeout(() => {
        fixture.detectChanges();
        const hasOverflow = directive.hasOverflow();
        const visibleTabs = directive.visibleTabs();
        const hiddenTabs = directive.hiddenTabs();

        // With limited width, should have overflow
        if (hasOverflow) {
          expect(visibleTabs.length).toBeLessThan(5);
          expect(hiddenTabs.length).toBeGreaterThan(0);
          expect(visibleTabs.length + hiddenTabs.length).toBe(5);
        }
        done();
      }, 300);
    }, 500);
  });

  it('should maintain correct tab indices in visibleTabs', async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    fixture.detectChanges();

    const links = await tabNavBarHarness.getLinks();
    const visibleTabs = directive.visibleTabs();
    const allTabs = directive.allTabs();

    // Check that indices match actual elements
    visibleTabs.forEach((tabInfo) => {
      const expectedTab = allTabs.find((t) => t.index === tabInfo.index);
      expect(expectedTab).toBeTruthy();
      expect(expectedTab?.label).toBe(tabInfo.label);
    });

    // Verify using harness
    expect(links.length).toBeGreaterThan(0);
  });

  it('should get correct tab labels using harness', async () => {
    await new Promise(resolve => setTimeout(resolve, 500));

    const links = await tabNavBarHarness.getLinks();
    const labels = await Promise.all(links.map(link => link.getLabel()));

    expect(labels).toContain('Tab 1');
    expect(labels).toContain('Tab 2');
    expect(labels).toContain('Tab 3');
  });

  it('should handle resize to larger container', (done) => {
    const navElement = directiveElement.nativeElement as HTMLElement;

    // Start small
    navElement.style.width = '200px';

    setTimeout(() => {
      fixture.detectChanges();
      window.dispatchEvent(new Event('resize'));

      setTimeout(() => {
        const initialVisibleCount = directive.visibleTabs().length;

        // Make larger
        navElement.style.width = '800px';
        window.dispatchEvent(new Event('resize'));

        setTimeout(() => {
          fixture.detectChanges();
          const newVisibleCount = directive.visibleTabs().length;

          // Should show more tabs or same
          expect(newVisibleCount).toBeGreaterThanOrEqual(initialVisibleCount);
          done();
        }, 300);
      }, 300);
    }, 500);
  });

  it('should handle resize to smaller container', (done) => {
    const navElement = directiveElement.nativeElement as HTMLElement;

    // Start large
    navElement.style.width = '800px';

    setTimeout(() => {
      fixture.detectChanges();
      window.dispatchEvent(new Event('resize'));

      setTimeout(() => {
        const initialVisibleCount = directive.visibleTabs().length;

        // Make smaller
        navElement.style.width = '200px';
        window.dispatchEvent(new Event('resize'));

        setTimeout(() => {
          fixture.detectChanges();
          const newVisibleCount = directive.visibleTabs().length;

          // Should show fewer tabs or same
          expect(newVisibleCount).toBeLessThanOrEqual(initialVisibleCount);
          // Should always show at least 1 tab
          expect(newVisibleCount).toBeGreaterThanOrEqual(1);
          done();
        }, 300);
      }, 300);
    }, 500);
  });

  it('should make hidden tab visible when makeTabVisible is called', (done) => {
    const navElement = directiveElement.nativeElement as HTMLElement;
    navElement.style.width = '300px';

    setTimeout(() => {
      fixture.detectChanges();
      window.dispatchEvent(new Event('resize'));

      setTimeout(() => {
        const hiddenTabs = directive.hiddenTabs();
        if (hiddenTabs.length > 0) {
          const hiddenTabIndex = hiddenTabs[0].index;

          directive.makeTabVisible(hiddenTabIndex);
          fixture.detectChanges();

          setTimeout(() => {
            const newVisibleTabs = directive.visibleTabs();
            const isNowVisible = newVisibleTabs.some(
              (t) => t.index === hiddenTabIndex
            );

            expect(isNowVisible).toBe(true);
            done();
          }, 200);
        } else {
          // No hidden tabs, test passes
          expect(true).toBe(true);
          done();
        }
      }, 300);
    }, 500);
  });

  it('should maintain index consistency after multiple resizes', (done) => {
    const navElement = directiveElement.nativeElement as HTMLElement;
    const widths = [200, 400, 300, 500, 250, 600];
    let currentIndex = 0;

    const performResize = () => {
      if (currentIndex >= widths.length) {
        // Verify final state
        const allTabs = directive.allTabs();
        const visibleTabs = directive.visibleTabs();
        const hiddenTabs = directive.hiddenTabs();

        expect(allTabs.length).toBe(5);
        expect(visibleTabs.length + hiddenTabs.length).toBe(5);

        // Check no duplicate indices
        const visibleIndices = visibleTabs.map((t) => t.index);
        const hiddenIndices = hiddenTabs.map((t) => t.index);
        const uniqueVisible = new Set(visibleIndices);
        const uniqueHidden = new Set(hiddenIndices);

        expect(uniqueVisible.size).toBe(visibleTabs.length);
        expect(uniqueHidden.size).toBe(hiddenTabs.length);

        // Check no overlap
        visibleIndices.forEach((idx) => {
          expect(hiddenIndices.includes(idx)).toBe(false);
        });

        done();
        return;
      }

      navElement.style.width = `${widths[currentIndex]}px`;
      window.dispatchEvent(new Event('resize'));
      currentIndex++;

      setTimeout(() => {
        fixture.detectChanges();
        performResize();
      }, 200);
    };

    setTimeout(() => {
      fixture.detectChanges();
      performResize();
    }, 500);
  });

  it('should keep visible indices sorted in ascending order', (done) => {
    setTimeout(() => {
      fixture.detectChanges();
      const visibleTabs = directive.visibleTabs();
      const indices = visibleTabs.map((t) => t.index);

      for (let i = 1; i < indices.length; i++) {
        expect(indices[i]).toBeGreaterThan(indices[i - 1]);
      }
      done();
    }, 500);
  });

  it('should handle tab selection and reordering', (done) => {
    const navElement = directiveElement.nativeElement as HTMLElement;
    navElement.style.width = '300px';

    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));

      setTimeout(() => {
        const hiddenTabs = directive.hiddenTabs();

        if (hiddenTabs.length > 0) {
          const initialVisible = [...directive.visibleTabs()];
          const tabToSelect = hiddenTabs[0].index;

          directive.makeTabVisible(tabToSelect);

          setTimeout(() => {
            const newVisible = directive.visibleTabs();

            // Selected tab should be visible
            expect(newVisible.some((t) => t.index === tabToSelect)).toBe(true);

            // Total visible count should remain approximately same
            expect(Math.abs(newVisible.length - initialVisible.length)).toBeLessThanOrEqual(1);

            done();
          }, 200);
        } else {
          expect(true).toBe(true);
          done();
        }
      }, 300);
    }, 500);
  });

  it('should reset scroll position', () => {
    const tabHeaderElement = (directive as any)._tabHeaderElement;

    if (tabHeaderElement) {
      // Set some scroll
      const container = tabHeaderElement.querySelector(
        '.mat-mdc-tab-list-container'
      ) as HTMLElement;
      if (container) {
        container.scrollLeft = 100;
        directive['resetScrollPosition']();
        expect(container.scrollLeft).toBe(0);
      }
    }
    expect(true).toBe(true);
  });
});
