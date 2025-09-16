import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface LayerState {
  temperatura: boolean;
  icebergs: boolean;
  pinturasRupestres: boolean;
  dem: boolean;
  clima: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LayerControlService {  private layerStateSubject = new BehaviorSubject<LayerState>({
    temperatura: true,
    icebergs: true,
    pinturasRupestres: true,
    dem: false,
    clima: false
  });

  public layerState$: Observable<LayerState> = this.layerStateSubject.asObservable();

  constructor() { }

  /**
   * Obtiene el estado actual de las capas
   */
  getCurrentState(): LayerState {
    return this.layerStateSubject.value;
  }

  /**
   * Alterna la visibilidad de la capa de temperatura
   */
  toggleTemperatura(): void {
    const currentState = this.layerStateSubject.value;
    this.layerStateSubject.next({
      ...currentState,
      temperatura: !currentState.temperatura
    });
  }

  /**
   * Alterna la visibilidad de la capa de icebergs
   */
  toggleIcebergs(): void {
    const currentState = this.layerStateSubject.value;
    this.layerStateSubject.next({
      ...currentState,
      icebergs: !currentState.icebergs
    });
  }

  /**
   * Alterna la visibilidad de la capa de pinturas rupestres
   */
  togglePinturasRupestres(): void {
    const currentState = this.layerStateSubject.value;
    this.layerStateSubject.next({
      ...currentState,
      pinturasRupestres: !currentState.pinturasRupestres
    });
  }
  /**
   * Alterna la visibilidad de la capa DEM
   */
  toggleDEM(): void {
    const currentState = this.layerStateSubject.value;
    const newDemState = !currentState.dem;
    console.log(`🗺️ LayerControlService: Cambiando DEM de ${currentState.dem} a ${newDemState}`);
    
    this.layerStateSubject.next({
      ...currentState,
      dem: newDemState
    });
  }  /**
   * Alterna la visibilidad de la capa de clima
   */
  toggleClima(): void {
    const currentState = this.layerStateSubject.value;
    const newClimaState = !currentState.clima;
    console.log(`🌤️ LayerControlService: Cambiando Clima de ${currentState.clima} a ${newClimaState}`);
    
    this.layerStateSubject.next({
      ...currentState,
      clima: newClimaState
    });
  }

  /**
   * Establece el estado de una capa específica
   */
  setLayerState(layer: 'temperatura' | 'icebergs' | 'pinturasRupestres' | 'dem' | 'clima', visible: boolean): void {
    const currentState = this.layerStateSubject.value;
    this.layerStateSubject.next({
      ...currentState,
      [layer]: visible
    });
  }

  /**
   * Establece el estado completo de las capas
   */
  setAllLayersState(state: LayerState): void {
    this.layerStateSubject.next(state);
  }
}
