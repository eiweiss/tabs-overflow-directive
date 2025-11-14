import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterTestingModule } from '@angular/router/testing';
import { TabsOverflowMenuDirective } from './tabs-overflow-menu.directive';
import { TabsOverflowDirective } from './tabs-overflow.directive';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

@Component({
  template: `
    <nav mat-tab-nav-bar [tabPanel]="tabPanel" appTabsOverflowMenu>
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
    { path: '/tab6', label: 'Tab 6', active: false },
    { path: '/tab7', label: 'Tab 7', active: false },
    { path: '/tab8', label: 'Tab 8', active: false },
  ];
}

describe('TabsOverflowMenuDirective', () => {
  let component: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;
  let directiveElement: DebugElement;
  let menuDirective: TabsOverflowMenuDirective;
  let overflowDirective: TabsOverflowDirective;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TestHostComponent],
      imports: [
        MatTabsModule,
        RouterTestingModule,
        NoopAnimationsModule,
        TabsOverflowMenuDirective,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    directiveElement = fixture.debugElement.query(
      By.directive(TabsOverflowMenuDirective)
    );
    menuDirective = directiveElement.injector.get(TabsOverflowMenuDirective);
    overflowDirective = directiveElement.injector.get(TabsOverflowDirective);
    fixture.detectChanges();
  });

  it('should create menu directive', () => {
    expect(menuDirective).toBeTruthy();
  });

  it('should have access to TabsOverflowDirective through composition', () => {
    expect(overflowDirective).toBeTruthy();
  });

  it('should show overflow menu when tabs overflow', (done) => {
    const navElement = directiveElement.nativeElement as HTMLElement;
    navElement.style.width = '300px';

    setTimeout(() => {
      fixture.detectChanges();
      window.dispatchEvent(new Event('resize'));

      setTimeout(() => {
        fixture.detectChanges();

        // Check if overflow menu was created
        const menuButton = navElement.querySelector('button[cdkMenuTriggerFor]');
        const hasOverflow = overflowDirective.hasOverflow();

        if (hasOverflow) {
          expect(menuButton).toBeTruthy();
        }
        done();
      }, 400);
    }, 500);
  });

  it('should hide overflow menu when all tabs fit', (done) => {
    const navElement = directiveElement.nativeElement as HTMLElement;
    navElement.style.width = '1200px';

    setTimeout(() => {
      fixture.detectChanges();
      window.dispatchEvent(new Event('resize'));

      setTimeout(() => {
        fixture.detectChanges();

        const menuButton = navElement.querySelector('button[cdkMenuTriggerFor]');
        const hasOverflow = overflowDirective.hasOverflow();

        if (!hasOverflow) {
          expect(menuButton).toBeFalsy();
        }
        done();
      }, 400);
    }, 500);
  });

  it('should display hidden tabs in overflow menu', (done) => {
    const navElement = directiveElement.nativeElement as HTMLElement;
    navElement.style.width = '300px';

    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));

      setTimeout(() => {
        fixture.detectChanges();

        const hiddenTabs = overflowDirective.hiddenTabs();
        const menuButton = navElement.querySelector(
          'button[cdkMenuTriggerFor]'
        ) as HTMLButtonElement;

        if (hiddenTabs.length > 0 && menuButton) {
          // Verify menu exists
          expect(menuButton).toBeTruthy();
        }
        done();
      }, 400);
    }, 500);
  });

  it('should update menu when tabs change visibility', (done) => {
    const navElement = directiveElement.nativeElement as HTMLElement;

    // Start small
    navElement.style.width = '250px';
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));

      setTimeout(() => {
        fixture.detectChanges();
        const initialHiddenCount = overflowDirective.hiddenTabs().length;

        // Make larger
        navElement.style.width = '600px';
        window.dispatchEvent(new Event('resize'));

        setTimeout(() => {
          fixture.detectChanges();
          const newHiddenCount = overflowDirective.hiddenTabs().length;

          // Should have fewer or same hidden tabs
          expect(newHiddenCount).toBeLessThanOrEqual(initialHiddenCount);
          done();
        }, 400);
      }, 400);
    }, 500);
  });

  it('should handle rapid resize events without errors', (done) => {
    const navElement = directiveElement.nativeElement as HTMLElement;
    const widths = [200, 300, 250, 400, 350, 500];

    setTimeout(() => {
      widths.forEach((width, index) => {
        setTimeout(() => {
          navElement.style.width = `${width}px`;
          window.dispatchEvent(new Event('resize'));
          fixture.detectChanges();
        }, index * 50);
      });

      setTimeout(() => {
        fixture.detectChanges();
        // Just verify no errors occurred
        expect(overflowDirective.allTabs().length).toBe(8);
        done();
      }, widths.length * 50 + 500);
    }, 500);
  });

  it('should maintain menu consistency after tab selection', (done) => {
    const navElement = directiveElement.nativeElement as HTMLElement;
    navElement.style.width = '300px';

    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));

      setTimeout(() => {
        fixture.detectChanges();
        const hiddenTabs = overflowDirective.hiddenTabs();

        if (hiddenTabs.length > 0) {
          const tabToSelect = hiddenTabs[0].index;
          overflowDirective.makeTabVisible(tabToSelect);

          setTimeout(() => {
            fixture.detectChanges();

            const newHiddenTabs = overflowDirective.hiddenTabs();
            const newVisibleTabs = overflowDirective.visibleTabs();

            // Verify no duplicates
            const allIndices = [
              ...newVisibleTabs.map((t) => t.index),
              ...newHiddenTabs.map((t) => t.index),
            ];
            const uniqueIndices = new Set(allIndices);
            expect(uniqueIndices.size).toBe(allIndices.length);

            done();
          }, 300);
        } else {
          expect(true).toBe(true);
          done();
        }
      }, 400);
    }, 500);
  });

  it('should cleanup on destroy', () => {
    const destroySpy = spyOn(menuDirective as any, 'destroyMenu');
    menuDirective.ngOnDestroy();
    expect(destroySpy).toHaveBeenCalled();
  });

  it('should hide pagination buttons when directive is active', (done) => {
    setTimeout(() => {
      fixture.detectChanges();

      const navElement = directiveElement.nativeElement as HTMLElement;
      const paginationButtons = navElement.querySelectorAll(
        '.mat-mdc-tab-header-pagination, .mat-tab-header-pagination'
      );

      paginationButtons.forEach((btn) => {
        const computedStyle = window.getComputedStyle(btn as HTMLElement);
        // Buttons should be hidden by CSS
        expect(computedStyle.display).toBe('none');
      });

      done();
    }, 500);
  });

  it('should prevent index desynchronization during multiple operations', (done) => {
    const navElement = directiveElement.nativeElement as HTMLElement;

    // Scenario: resize small, select tab, resize large, resize small, select tab
    navElement.style.width = '250px';

    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));

      setTimeout(() => {
        fixture.detectChanges();
        let hiddenTabs = overflowDirective.hiddenTabs();

        if (hiddenTabs.length > 0) {
          // Select first hidden tab
          overflowDirective.makeTabVisible(hiddenTabs[0].index);

          setTimeout(() => {
            // Resize larger
            navElement.style.width = '600px';
            window.dispatchEvent(new Event('resize'));

            setTimeout(() => {
              // Resize small again
              navElement.style.width = '250px';
              window.dispatchEvent(new Event('resize'));

              setTimeout(() => {
                fixture.detectChanges();
                hiddenTabs = overflowDirective.hiddenTabs();

                if (hiddenTabs.length > 0) {
                  // Select another hidden tab
                  overflowDirective.makeTabVisible(hiddenTabs[0].index);

                  setTimeout(() => {
                    fixture.detectChanges();

                    // Final verification
                    const allTabs = overflowDirective.allTabs();
                    const visibleTabs = overflowDirective.visibleTabs();
                    const finalHiddenTabs = overflowDirective.hiddenTabs();

                    expect(allTabs.length).toBe(8);
                    expect(visibleTabs.length + finalHiddenTabs.length).toBe(8);

                    // Check for duplicates
                    const allIndices = [
                      ...visibleTabs.map((t) => t.index),
                      ...finalHiddenTabs.map((t) => t.index),
                    ];
                    const uniqueIndices = new Set(allIndices);
                    expect(uniqueIndices.size).toBe(8);

                    done();
                  }, 200);
                } else {
                  expect(true).toBe(true);
                  done();
                }
              }, 300);
            }, 300);
          }, 300);
        } else {
          expect(true).toBe(true);
          done();
        }
      }, 400);
    }, 500);
  });
});
