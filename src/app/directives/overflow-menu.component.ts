import {
  Component,
  EventEmitter,
  Output,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkMenuModule } from '@angular/cdk/menu';

/**
 * Dropdown menu component that displays overflow tabs
 */
@Component({
  selector: 'app-overflow-menu',
  standalone: true,
  imports: [CommonModule, CdkMenuModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-menu-container">
      <button
        class="overflow-menu-trigger"
        [cdkMenuTriggerFor]="menu"
        type="button"
        aria-label="More tabs"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="1"></circle>
          <circle cx="12" cy="5" r="1"></circle>
          <circle cx="12" cy="19" r="1"></circle>
        </svg>
      </button>

      <ng-template #menu>
        <div class="overflow-menu" cdkMenu>
          @if (visibleTabs().length > 0) {
            <div class="overflow-menu-section">
              <div class="overflow-menu-label">Visible Tabs</div>
              @for (tab of visibleTabs(); track tab.index) {
                <button
                  class="overflow-menu-item visible-tab"
                  cdkMenuItem
                  (click)="onTabSelect(tab.index)"
                  type="button"
                >
                  {{ tab.label }}
                </button>
              }
            </div>
          }

          @if (hiddenTabs().length > 0) {
            <div class="overflow-menu-section">
              <div class="overflow-menu-label">Hidden Tabs</div>
              @for (tab of hiddenTabs(); track tab.index) {
                <button
                  class="overflow-menu-item hidden-tab"
                  cdkMenuItem
                  (click)="onTabSelect(tab.index)"
                  type="button"
                >
                  {{ tab.label }}
                </button>
              }
            </div>
          }
        </div>
      </ng-template>
    </div>
  `,
  styles: [
    `
      .overflow-menu-container {
        display: flex;
        align-items: center;
        margin-right: 8px;
      }

      .overflow-menu-trigger {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        padding: 8px;
        border: none;
        background: transparent;
        border-radius: 50%;
        cursor: pointer;
        color: rgba(0, 0, 0, 0.54);
        transition: background-color 0.2s ease;
      }

      .overflow-menu-trigger:hover {
        background-color: rgba(0, 0, 0, 0.04);
      }

      .overflow-menu-trigger:active {
        background-color: rgba(0, 0, 0, 0.08);
      }

      .overflow-menu-trigger svg {
        width: 24px;
        height: 24px;
      }

      .overflow-menu {
        min-width: 200px;
        max-width: 300px;
        max-height: 400px;
        overflow-y: auto;
        background: white;
        border-radius: 4px;
        box-shadow: 0 5px 5px -3px rgba(0, 0, 0, 0.2),
          0 8px 10px 1px rgba(0, 0, 0, 0.14),
          0 3px 14px 2px rgba(0, 0, 0, 0.12);
        padding: 8px 0;
      }

      .overflow-menu-section {
        margin-bottom: 8px;
      }

      .overflow-menu-section:last-child {
        margin-bottom: 0;
      }

      .overflow-menu-label {
        padding: 8px 16px;
        font-size: 12px;
        font-weight: 500;
        color: rgba(0, 0, 0, 0.54);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .overflow-menu-item {
        display: block;
        width: 100%;
        padding: 12px 16px;
        border: none;
        background: transparent;
        text-align: left;
        cursor: pointer;
        font-size: 14px;
        color: rgba(0, 0, 0, 0.87);
        transition: background-color 0.2s ease;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .overflow-menu-item:hover {
        background-color: rgba(0, 0, 0, 0.04);
      }

      .overflow-menu-item:focus {
        outline: none;
        background-color: rgba(0, 0, 0, 0.08);
      }

      .overflow-menu-item.visible-tab {
        font-weight: 500;
      }

      .overflow-menu-item.hidden-tab {
        opacity: 0.7;
      }
    `,
  ],
})
export class OverflowMenuComponent {
  @Output() tabSelected = new EventEmitter<number>();

  visibleTabs = signal<Array<{ label: string; index: number }>>([]);
  hiddenTabs = signal<Array<{ label: string; index: number }>>([]);

  /**
   * Updates the tabs displayed in the menu
   */
  updateTabs(
    visible: Array<{ label: string; index: number }>,
    hidden: Array<{ label: string; index: number }>
  ): void {
    this.visibleTabs.set(visible);
    this.hiddenTabs.set(hidden);
  }

  /**
   * Handles tab selection
   */
  onTabSelect(index: number): void {
    this.tabSelected.emit(index);
  }
}
