import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-pueblos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pueblos.component.html',
  styleUrls: ['./pueblos.component.scss']
})
export class PueblosComponent {
  pueblosText: string = `
    Diversos pueblos originarios habitaron la Patagonia: los kawésqar, aónikenk, yaganes y mapuche, entre otros.
    Cada uno desarrolló una relación única con los glaciares y el entorno, adaptando sus costumbres y creencias al clima y la geografía.

    Los glaciares eran fuente de agua, rutas de viaje y elementos sagrados. Sus historias y leyendas reflejan el profundo respeto
    y admiración por estos gigantes de hielo, considerados parte esencial de su identidad y supervivencia.

    Los kawésqar navegaban los canales y fiordos, los aónikenk recorrían las estepas, y los mapuche mantenían una conexión espiritual
    con los elementos naturales. Cada pueblo aportó su visión y conocimiento, enriqueciendo la cultura patagónica.`;

  showQuestions = false;

  preguntas = [
    {
      texto: '¿Qué función tenían los glaciares para los pueblos originarios?',
      opciones: [
        'Solo eran obstáculos',
        'Fuente de agua, rutas y elementos sagrados',
        'No tenían función',
        'Solo eran peligrosos'
      ],
      respuesta: 'Fuente de agua, rutas y elementos sagrados',
      seleccionada: '',
      respondida: false
    },
    {
      texto: '¿Qué pueblo navegaba los canales y fiordos?',
      opciones: [
        'Aónikenk',
        'Mapuche',
        'Kawésqar',
        'Yaganes'
      ],
      respuesta: 'Kawésqar',
      seleccionada: '',
      respondida: false
    }
  ];

  responderPregunta(q: any) {
    q.respondida = true;
  }
}
