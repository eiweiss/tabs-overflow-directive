import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTabNavBarHarness } from '@angular/material/tabs/testing';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TabsOverflowMenuDirective } from './tabs-overflow-menu.directive';
import { TabsOverflowDirective } from './tabs-overflow.directive';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

@Component({
  template: `
    <nav mat-tab-nav-bar [tabPanel]="tabPanel" appTabsOverflowMenu>
      @for (link of links; track $index) {
        <a mat-tab-link [active]="link.active" (click)="onTabClick(link)">
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
    { label: 'Tab 0', active: false },
    { label: 'Tab 1', active: false },
    { label: 'Tab 2', active: false },
    { label: 'Tab 3', active: false },
    { label: 'Tab 4', active: false },
    { label: 'Tab 5', active: false },
    { label: 'Tab 6', active: false },
    { label: 'Tab 7', active: false },
    { label: 'Tab 8', active: false },
    { label: 'Tab 9', active: false },
  ];

  onTabClick(link: any): void {
    this.links.forEach(l => l.active = false);
    link.active = true;
  }
}

describe('TabsOverflow Stress Tests - Deep Nesting', () => {
  let component: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;
  let directiveElement: DebugElement;
  let menuDirective: TabsOverflowMenuDirective;
  let overflowDirective: TabsOverflowDirective;
  let loader: HarnessLoader;
  let tabNavBarHarness: MatTabNavBarHarness;
  let navElement: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TestHostComponent],
      imports: [
        MatTabsModule,
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
    loader = TestbedHarnessEnvironment.loader(fixture);
    navElement = directiveElement.nativeElement as HTMLElement;
    fixture.detectChanges();

    tabNavBarHarness = await loader.getHarness(MatTabNavBarHarness);
  });

  function validateIndexConsistency(context: string): void {
    const allTabs = overflowDirective.allTabs();
    const visibleTabs = overflowDirective.visibleTabs();
    const hiddenTabs = overflowDirective.hiddenTabs();

    // Total should match
    expect(visibleTabs.length + hiddenTabs.length).withContext(`${context}: Total count mismatch`).toBe(10);

    // No duplicates in visible
    const visibleIndices = visibleTabs.map(t => t.index);
    const uniqueVisible = new Set(visibleIndices);
    expect(uniqueVisible.size).withContext(`${context}: Duplicate in visible`).toBe(visibleTabs.length);

    // No duplicates in hidden
    const hiddenIndices = hiddenTabs.map(t => t.index);
    const uniqueHidden = new Set(hiddenIndices);
    expect(uniqueHidden.size).withContext(`${context}: Duplicate in hidden`).toBe(hiddenTabs.length);

    // No overlap between visible and hidden
    visibleIndices.forEach(idx => {
      expect(hiddenIndices.includes(idx)).withContext(`${context}: Index ${idx} in both visible and hidden`).toBe(false);
    });

    // Indices should be sorted in visible
    for (let i = 1; i < visibleIndices.length; i++) {
      expect(visibleIndices[i]).withContext(`${context}: Visible indices not sorted`).toBeGreaterThan(visibleIndices[i - 1]);
    }

    // Labels should match indices
    visibleTabs.forEach(tab => {
      expect(tab.label).withContext(`${context}: Label mismatch for index ${tab.index}`).toBe(`Tab ${tab.index}`);
    });
    hiddenTabs.forEach(tab => {
      expect(tab.label).withContext(`${context}: Label mismatch for index ${tab.index}`).toBe(`Tab ${tab.index}`);
    });
  }

  async function resize(width: number, delay: number = 200): Promise<void> {
    navElement.style.width = `${width}px`;
    window.dispatchEvent(new Event('resize'));
    await new Promise(resolve => setTimeout(resolve, delay));
    fixture.detectChanges();
  }

  async function selectHiddenTab(tabIndex?: number, delay: number = 200): Promise<void> {
    const hiddenTabs = overflowDirective.hiddenTabs();
    if (hiddenTabs.length > 0) {
      const indexToSelect = tabIndex !== undefined
        ? hiddenTabs.find(t => t.index === tabIndex)?.index
        : hiddenTabs[0].index;

      if (indexToSelect !== undefined) {
        overflowDirective.makeTabVisible(indexToSelect);
        await new Promise(resolve => setTimeout(resolve, delay));
        fixture.detectChanges();
      }
    }
  }

  it('STRESS: 3-level nested operations', async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    validateIndexConsistency('Initial');

    await resize(250);
    validateIndexConsistency('After resize 250');

    await selectHiddenTab();
    validateIndexConsistency('After select 1');

    await resize(400);
    validateIndexConsistency('After resize 400');

    await resize(250);
    validateIndexConsistency('After resize back 250');

    await selectHiddenTab();
    validateIndexConsistency('After select 2');

    await resize(600);
    validateIndexConsistency('After resize 600');
  });

  it('STRESS: 5-level nested resize/select cycle', async () => {
    await new Promise(resolve => setTimeout(resolve, 500));

    const operations = [
      { width: 200, select: true },
      { width: 500, select: false },
      { width: 250, select: true },
      { width: 700, select: false },
      { width: 300, select: true },
      { width: 400, select: true },
      { width: 250, select: true },
    ];

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      await resize(op.width);
      validateIndexConsistency(`After resize to ${op.width} (step ${i})`);

      if (op.select) {
        await selectHiddenTab();
        validateIndexConsistency(`After select (step ${i})`);
      }
    }
  });

  it('STRESS: Select specific tab indices in sequence', async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    navElement.style.width = '250px';
    await resize(250);

    const tabSequence = [7, 3, 9, 2, 5, 8, 1, 6];

    for (const tabIdx of tabSequence) {
      const hiddenTabs = overflowDirective.hiddenTabs();
      if (hiddenTabs.some(t => t.index === tabIdx)) {
        await selectHiddenTab(tabIdx);
        validateIndexConsistency(`After selecting tab ${tabIdx}`);

        // Verify the selected tab is now visible
        const visibleTabs = overflowDirective.visibleTabs();
        expect(visibleTabs.some(t => t.index === tabIdx))
          .withContext(`Tab ${tabIdx} should be visible after selection`)
          .toBe(true);
      }
    }
  });

  it('STRESS: Rapid resize oscillation', async () => {
    await new Promise(resolve => setTimeout(resolve, 500));

    const widths = [250, 500, 300, 600, 280, 550, 320, 700, 250, 800];

    for (let i = 0; i < widths.length; i++) {
      await resize(widths[i], 150);
      validateIndexConsistency(`Rapid resize ${i}: ${widths[i]}px`);

      if (i % 2 === 0) {
        await selectHiddenTab(undefined, 150);
        validateIndexConsistency(`Rapid select after resize ${i}`);
      }
    }
  });

  it('STRESS: Small -> Select -> Smaller -> Select -> Tiny -> Select', async () => {
    await new Promise(resolve => setTimeout(resolve, 500));

    await resize(400);
    validateIndexConsistency('Resize 400');

    await selectHiddenTab();
    validateIndexConsistency('Select after 400');

    await resize(300);
    validateIndexConsistency('Resize 300');

    await selectHiddenTab();
    validateIndexConsistency('Select after 300');

    await resize(250);
    validateIndexConsistency('Resize 250');

    await selectHiddenTab();
    validateIndexConsistency('Select after 250');

    await resize(220);
    validateIndexConsistency('Resize 220');

    await selectHiddenTab();
    validateIndexConsistency('Select after 220');
  });

  it('STRESS: Large -> Small with multiple selections', async () => {
    await new Promise(resolve => setTimeout(resolve, 500));

    await resize(800);
    validateIndexConsistency('Start large');

    await resize(250);
    validateIndexConsistency('Go small');

    // Select multiple tabs in succession
    for (let i = 0; i < 5; i++) {
      await selectHiddenTab();
      validateIndexConsistency(`Multi-select ${i + 1}`);
    }

    await resize(800);
    validateIndexConsistency('Back to large');

    await resize(250);
    validateIndexConsistency('Back to small');

    // Select again
    for (let i = 0; i < 3; i++) {
      await selectHiddenTab();
      validateIndexConsistency(`Second multi-select ${i + 1}`);
    }
  });

  it('STRESS: Edge case - select last tab repeatedly', async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    await resize(250);

    for (let i = 0; i < 5; i++) {
      const hiddenTabs = overflowDirective.hiddenTabs();
      if (hiddenTabs.length > 0) {
        const lastHiddenTab = hiddenTabs[hiddenTabs.length - 1];
        await selectHiddenTab(lastHiddenTab.index);
        validateIndexConsistency(`Select last hidden tab iteration ${i}`);
      }
    }
  });

  it('STRESS: Edge case - select first tab repeatedly', async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    await resize(250);

    for (let i = 0; i < 5; i++) {
      const hiddenTabs = overflowDirective.hiddenTabs();
      if (hiddenTabs.length > 0) {
        const firstHiddenTab = hiddenTabs[0];
        await selectHiddenTab(firstHiddenTab.index);
        validateIndexConsistency(`Select first hidden tab iteration ${i}`);
      }
    }
  });

  it('STRESS: Alternating resize and select with validation', async () => {
    await new Promise(resolve => setTimeout(resolve, 500));

    const pattern = [
      { width: 250, selectCount: 1 },
      { width: 350, selectCount: 0 },
      { width: 250, selectCount: 2 },
      { width: 450, selectCount: 0 },
      { width: 250, selectCount: 1 },
      { width: 550, selectCount: 0 },
      { width: 250, selectCount: 3 },
    ];

    for (let p = 0; p < pattern.length; p++) {
      const { width, selectCount } = pattern[p];

      await resize(width);
      validateIndexConsistency(`Pattern ${p}: resize to ${width}`);

      for (let s = 0; s < selectCount; s++) {
        await selectHiddenTab();
        validateIndexConsistency(`Pattern ${p}: select ${s + 1}/${selectCount}`);
      }
    }
  });

  it('STRESS: 10-deep nested operations', async () => {
    await new Promise(resolve => setTimeout(resolve, 500));

    // Level 1
    await resize(250);
    validateIndexConsistency('L1: resize 250');

    await selectHiddenTab();
    validateIndexConsistency('L1: select');

    // Level 2
    await resize(400);
    validateIndexConsistency('L2: resize 400');

    await selectHiddenTab();
    validateIndexConsistency('L2: select');

    // Level 3
    await resize(280);
    validateIndexConsistency('L3: resize 280');

    await selectHiddenTab();
    validateIndexConsistency('L3: select');

    // Level 4
    await resize(500);
    validateIndexConsistency('L4: resize 500');

    await resize(270);
    validateIndexConsistency('L4: resize 270');

    await selectHiddenTab();
    validateIndexConsistency('L4: select');

    // Level 5
    await resize(600);
    validateIndexConsistency('L5: resize 600');

    await resize(250);
    validateIndexConsistency('L5: resize 250');

    await selectHiddenTab();
    validateIndexConsistency('L5: select 1');

    await selectHiddenTab();
    validateIndexConsistency('L5: select 2');

    // Level 6
    await resize(350);
    validateIndexConsistency('L6: resize 350');

    await resize(240);
    validateIndexConsistency('L6: resize 240');

    await selectHiddenTab();
    validateIndexConsistency('L6: select');

    // Level 7
    await resize(700);
    validateIndexConsistency('L7: resize 700');

    await resize(250);
    validateIndexConsistency('L7: resize 250');

    await selectHiddenTab();
    validateIndexConsistency('L7: select');

    // Level 8
    await resize(300);
    validateIndexConsistency('L8: resize 300');

    await selectHiddenTab();
    validateIndexConsistency('L8: select 1');

    await selectHiddenTab();
    validateIndexConsistency('L8: select 2');

    await resize(250);
    validateIndexConsistency('L8: resize 250');

    // Level 9
    await selectHiddenTab();
    validateIndexConsistency('L9: select 1');

    await resize(800);
    validateIndexConsistency('L9: resize 800');

    await resize(230);
    validateIndexConsistency('L9: resize 230');

    await selectHiddenTab();
    validateIndexConsistency('L9: select 2');

    // Level 10
    await resize(350);
    validateIndexConsistency('L10: resize 350');

    await resize(250);
    validateIndexConsistency('L10: resize 250');

    await selectHiddenTab();
    validateIndexConsistency('L10: select 1');

    await selectHiddenTab();
    validateIndexConsistency('L10: select 2');

    await selectHiddenTab();
    validateIndexConsistency('L10: select 3');
  });

  it('STRESS: Verify tab element visibility matches directive state', async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    await resize(250);

    const visibleTabs = overflowDirective.visibleTabs();
    const hiddenTabs = overflowDirective.hiddenTabs();

    // Check that visible tabs are actually visible in DOM
    visibleTabs.forEach(tabInfo => {
      const computedStyle = window.getComputedStyle(tabInfo.element);
      expect(computedStyle.display).withContext(`Tab ${tabInfo.index} should be visible`).not.toBe('none');
    });

    // Check that hidden tabs are actually hidden in DOM
    hiddenTabs.forEach(tabInfo => {
      const computedStyle = window.getComputedStyle(tabInfo.element);
      expect(computedStyle.display).withContext(`Tab ${tabInfo.index} should be hidden`).toBe('none');
    });
  });
});
