import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: '/simulador', pathMatch: 'full' },
  { 
    path: 'simulador', 
    loadComponent: () => import('./pages/simulador/simulador.component').then(m => m.SimuladorComponent)
  },  { 
    path: 'alerta', 
    loadComponent: () => import('./pages/alerta/alerta.component').then(m => m.AlertaComponent)
  },
  { 
    path: 'atlas', 
    loadComponent: () => import('./pages/atlas/atlas.component').then(m => m.AtlasComponent)
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
