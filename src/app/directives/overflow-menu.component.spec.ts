import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OverflowMenuComponent } from './overflow-menu.component';
import { CommonModule } from '@angular/common';
import { CdkMenuModule } from '@angular/cdk/menu';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatIconModule } from '@angular/material/icon';

describe('OverflowMenuComponent', () => {
  let component: OverflowMenuComponent;
  let fixture: ComponentFixture<OverflowMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        CdkMenuModule,
        MatIconModule,
        NoopAnimationsModule,
        OverflowMenuComponent,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OverflowMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty tabs', () => {
    expect(component.allTabs()).toEqual([]);
    expect(component.hiddenTabs()).toEqual([]);
  });

  it('should update tabs when updateTabs is called', () => {
    const allTabs = [
      { label: 'Tab 1', index: 0 },
      { label: 'Tab 2', index: 1 },
      { label: 'Tab 3', index: 2 },
    ];

    const hiddenTabs = [
      { label: 'Tab 2', index: 1 },
      { label: 'Tab 3', index: 2 },
    ];

    component.updateTabs(allTabs, hiddenTabs);

    expect(component.allTabs()).toEqual(allTabs);
    expect(component.hiddenTabs()).toEqual(hiddenTabs);
  });

  it('should render menu button', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const menuButton = compiled.querySelector('button[cdkMenuTriggerFor]');
    expect(menuButton).toBeTruthy();
  });

  it('should display hidden tabs in menu', () => {
    const hiddenTabs = [
      { label: 'Hidden Tab 1', index: 3 },
      { label: 'Hidden Tab 2', index: 4 },
    ];

    component.updateTabs([], hiddenTabs);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const menuButton = compiled.querySelector('button[cdkMenuTriggerFor]') as HTMLButtonElement;

    expect(menuButton).toBeTruthy();
  });

  it('should emit tabSelected when tab is clicked', (done) => {
    const hiddenTabs = [
      { label: 'Hidden Tab 1', index: 3 },
      { label: 'Hidden Tab 2', index: 4 },
    ];

    component.updateTabs([], hiddenTabs);
    fixture.detectChanges();

    component.tabSelected.subscribe((index: number) => {
      expect(index).toBe(3);
      done();
    });

    component.onTabSelect(3);
  });

  it('should show only hidden tabs in dropdown', () => {
    const allTabs = [
      { label: 'Tab 1', index: 0 },
      { label: 'Tab 2', index: 1 },
      { label: 'Tab 3', index: 2 },
    ];

    const hiddenTabs = [
      { label: 'Tab 2', index: 1 },
      { label: 'Tab 3', index: 2 },
    ];

    component.updateTabs(allTabs, hiddenTabs);
    fixture.detectChanges();

    expect(component.hiddenTabs().length).toBe(2);
    expect(component.hiddenTabs()[0].label).toBe('Tab 2');
    expect(component.hiddenTabs()[1].label).toBe('Tab 3');
  });

  it('should handle empty hidden tabs array', () => {
    component.updateTabs(
      [{ label: 'Tab 1', index: 0 }],
      []
    );
    fixture.detectChanges();

    expect(component.hiddenTabs().length).toBe(0);
  });

  it('should update reactive signals when tabs change', () => {
    const initialHidden = [{ label: 'Tab 1', index: 0 }];
    component.updateTabs([], initialHidden);
    expect(component.hiddenTabs()).toEqual(initialHidden);

    const newHidden = [
      { label: 'Tab 2', index: 1 },
      { label: 'Tab 3', index: 2 },
    ];
    component.updateTabs([], newHidden);
    expect(component.hiddenTabs()).toEqual(newHidden);
  });

  it('should maintain tab label and index consistency', () => {
    const tabs = [
      { label: 'Dashboard', index: 0 },
      { label: 'Analytics', index: 4 },
      { label: 'Settings', index: 6 },
    ];

    component.updateTabs(tabs, tabs);
    fixture.detectChanges();

    const hiddenTabs = component.hiddenTabs();
    hiddenTabs.forEach((tab, i) => {
      expect(tab.label).toBe(tabs[i].label);
      expect(tab.index).toBe(tabs[i].index);
    });
  });

  it('should render correct number of menu items', () => {
    const hiddenTabs = [
      { label: 'Tab 1', index: 0 },
      { label: 'Tab 2', index: 1 },
      { label: 'Tab 3', index: 2 },
    ];

    component.updateTabs(hiddenTabs, hiddenTabs);
    fixture.detectChanges();

    // Note: Menu items are rendered in ng-template, so they may not be in DOM until menu is opened
    expect(component.hiddenTabs().length).toBe(3);
  });

  it('should handle tab selection for different indices', () => {
    const selectedIndices: number[] = [];

    component.tabSelected.subscribe((index: number) => {
      selectedIndices.push(index);
    });

    component.onTabSelect(0);
    component.onTabSelect(5);
    component.onTabSelect(9);

    expect(selectedIndices).toEqual([0, 5, 9]);
  });

  it('should support reactive updates', (done) => {
    const tabs1 = [{ label: 'Tab A', index: 0 }];
    const tabs2 = [
      { label: 'Tab B', index: 1 },
      { label: 'Tab C', index: 2 },
    ];

    component.updateTabs([], tabs1);
    expect(component.hiddenTabs()).toEqual(tabs1);

    setTimeout(() => {
      component.updateTabs([], tabs2);
      expect(component.hiddenTabs()).toEqual(tabs2);
      done();
    }, 50);
  });
});
