import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface InformacionSeleccionada {
  tipo: 'temperatura' | 'glaciar' | 'pinturaRupestre' | 'clima';
  data: any;
}

@Injectable({
  providedIn: 'root'
})
export class InformacionService {
  private informacionSubject = new BehaviorSubject<InformacionSeleccionada | null>(null);
  public informacion$: Observable<InformacionSeleccionada | null> = this.informacionSubject.asObservable();

  constructor() { }

  /**
   * Muestra información de un elemento seleccionado
   */
  mostrarInformacion(info: InformacionSeleccionada): void {
    this.informacionSubject.next(info);
  }

  /**
   * Cierra la información mostrada
   */
  cerrarInformacion(): void {
    this.informacionSubject.next(null);
  }

  /**
   * Obtiene la información actual
   */
  getInformacionActual(): InformacionSeleccionada | null {
    return this.informacionSubject.value;
  }
}
