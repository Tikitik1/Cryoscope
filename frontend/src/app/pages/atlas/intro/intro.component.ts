import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-intro',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './intro.component.html',
  styleUrls: ['./intro.component.scss']
})
export class IntroComponent {
  introductionText: string = `
    La Región de Aysén, en la Patagonia chilena, alberga una impresionante cantidad de hielo continental:
    más del 85% de la superficie de los Campos de Hielo Sur de Chile y cerca del 39% de todos los glaciares del país.

    Estos glaciares son verdaderos “termómetros” del clima global. En épocas prehispánicas, la zona fue habitada
    por pueblos originarios como los kawésqar en el oeste y los aónikenk en el este, quienes atribuyeron a los glaciares
    un carácter sagrado y espiritual.

    En la cosmovisión mapuche, los Ngen son espíritus protectores que habitan los elementos naturales. El Ngen-Winkul,
    por ejemplo, cuida de las montañas, mientras que el Ngen-Ko protege las aguas. El respeto y la armonía con la
    naturaleza son claves para comprender su cultura.

    Esta introducción nos invita a mirar los glaciares no solo como masas de hielo, sino como entidades vivas,
    culturales y científicas a la vez.
  `;
}
