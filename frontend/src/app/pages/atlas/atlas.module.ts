import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AtlasComponent } from './atlas.component';

const routes: Routes = [
  { path: '', component: AtlasComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AtlasModule { }
