import { Component } from '@angular/core';

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: false,
})
export class AppComponent {
  name = 'Angular';

  // Array of tab links for demonstration
  links = [
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
    { path: '/dashboard', label: 'Dashboard 2' },
    { path: '/analytics', label: 'Analytics 2' },
    { path: '/reports', label: 'Reports 2' },
    { path: '/settings', label: 'Settings 2' },
    { path: '/profile', label: 'Profile 2' },
    { path: '/notifications', label: 'Notifications 2' },
    { path: '/messages', label: 'Messages 2' },
  ];
}
