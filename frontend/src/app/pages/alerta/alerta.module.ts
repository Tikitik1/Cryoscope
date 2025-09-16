import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AlertaComponent } from './alerta.component';

const routes: Routes = [
  { path: '', component: AlertaComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AlertaModule { }
