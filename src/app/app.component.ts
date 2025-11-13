import { Component } from '@angular/core';

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: false,
})
export class AppComponent {
  name = 'Angular';

  // Fixed set of tab links for demonstration
  readonly links = [
    { path: '/home', label: 'Home' },
    { path: '/search', label: 'Search' },
    { path: '/others', label: 'Others' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/analytics', label: 'Analytics' },
    { path: '/reports', label: 'Reports' },
    { path: '/settings', label: 'Settings' },
    { path: '/profile', label: 'Profile' },
    { path: '/notifications', label: 'Notifications' },
    { path: '/messages', label: 'Messages' },
  ];
}
