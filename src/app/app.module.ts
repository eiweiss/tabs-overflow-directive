import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule, NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';

import { Routes, RouterModule } from '@angular/router';

import { AppComponent } from './app.component';
import { HelloComponent } from './hello.component';
import { HomeComponent } from './home/home.component';
import { SearchComponent } from './search/search.component';
import { OthersComponent } from './others/others.component';

import 'hammerjs';

import { MatTabsModule } from '@angular/material';

const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'search', component: SearchComponent },
  { path: 'others', component: OthersComponent }
];

@NgModule({
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    NoopAnimationsModule,
    FormsModule,
    MatTabsModule,
    RouterModule.forRoot(routes)
  ],
  declarations: [
    AppComponent, 
    HelloComponent, 
    HomeComponent, 
    SearchComponent, 
    OthersComponent
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
