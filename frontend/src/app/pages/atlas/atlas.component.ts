import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IntroComponent } from './intro/intro.component';
import { CosmovisionComponent } from './cosmovision/cosmovision.component';
import { PueblosComponent } from './pueblos/pueblos.component';
import { HistoriaComponent } from './historia/historia.component';
import { MetodosComponent } from './metodos/metodos.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-atlas',
  standalone: true,
  imports: [
    CommonModule,
    IntroComponent,
    CosmovisionComponent,
    PueblosComponent,
    HistoriaComponent,
    MetodosComponent,
    FormsModule
  ],
  template: `
    <div class="atlas-container">
      <div class="star-bg">
        <span class="bg-star s1"></span>
        <span class="bg-star s2"></span>
        <span class="bg-star s3"></span>
        <span class="bg-star s4"></span>
        <span class="bg-star s5"></span>
        <span class="bg-star s6"></span>
        <span class="bg-star s7"></span>
        <span class="bg-star s8"></span>
        <span class="bg-star s9"></span>
        <span class="bg-star s10"></span>
        <span class="bg-star s11"></span>
        <span class="bg-star s12"></span>
        <span class="bg-star s13"></span>
        <span class="bg-star s14"></span>
        <span class="bg-star s15"></span>
        <span class="bg-star s16"></span>
        <span class="bg-star s17"></span>
        <span class="bg-star s18"></span>
        <span class="bg-star s19"></span>
        <span class="bg-star s20"></span>
        <span class="bg-star s21"></span>
        <span class="bg-star s22"></span>
        <span class="bg-star s23"></span>
        <span class="bg-star s24"></span>
        <span class="bg-star s25"></span>
        <span class="bg-star s26"></span>
        <span class="bg-star s27"></span>
        <span class="bg-star s28"></span>
        <span class="bg-star s29"></span>
        <span class="bg-star s30"></span>
      </div>
      <div class="header-section">
        <h1>Atlas</h1>
        <p>Aprende la importancia de los glaciares</p>
      </div>
      <div *ngIf="!showBook" class="constellation">
        <div *ngFor="let star of stars" class="star" [style.left]="star.x + '%'" [style.top]="star.y + '%'" (click)="openBook(star)">
          <span class="star-shape"></span>
          <span class="star-label">{{ star.label }}</span>
        </div>
        <svg class="constellation-lines">
          <line *ngFor="let line of constellationLines" [attr.x1]="line.x1+'%'" [attr.y1]="line.y1+'%'" [attr.x2]="line.x2+'%'" [attr.y2]="line.y2+'%'" stroke="#fff8" stroke-width="2" />
        </svg>
      </div>
      <div *ngIf="showBook && currentModule === 'Introducción' && !showQuestions" class="book-fade-in book-centered">
        <div class="intro-book">
          <button class="close-btn" (click)="closeBook()" aria-label="Cerrar">×</button>
          <app-intro></app-intro>
          <button class="book-next-btn" (click)="showQuestions = true">Ir a las preguntas</button>
        </div>
      </div>
      <div *ngIf="showBook && currentModule === 'Introducción' && showQuestions" class="book-fade-in book-centered">
        <div class="questions-book">
          <button class="close-btn" (click)="closeBook()" aria-label="Cerrar">×</button>
          <h2>Responde sobre la introducción</h2>
          <form *ngFor="let q of questions; let i = index" class="question-block">
            <div class="question-title">{{q.text}}</div>
            <div class="question-options">
              <label *ngFor="let opt of q.options">
                <input type="radio" name="q{{i}}" [value]="opt" [(ngModel)]="q.selected" [disabled]="q.answered" />
                {{opt}}
              </label>
            </div>
            <div *ngIf="q.answered" class="question-feedback" [ngClass]="{'correct': q.selected === q.answer, 'incorrect': q.selected !== q.answer}">
              {{ q.selected === q.answer ? '¡Correcto!' : 'Incorrecto' }}
            </div>
            <button *ngIf="!q.answered" type="button" class="book-next-btn small" (click)="answerQuestion(q)">Responder</button>
          </form>
        </div>
      </div>
      <div *ngIf="showBook && currentModule === 'Cosmovisión'" class="book-fade-in book-centered">
        <div class="intro-book">
          <button class="close-btn" (click)="closeBook()" aria-label="Cerrar">×</button>
          <app-cosmovision></app-cosmovision>
        </div>
      </div>
      <div *ngIf="showBook && currentModule === 'Pueblos'" class="book-fade-in book-centered">
        <div class="intro-book">
          <button class="close-btn" (click)="closeBook()" aria-label="Cerrar">×</button>
          <app-pueblos></app-pueblos>
        </div>
      </div>
      <div *ngIf="showBook && currentModule === 'Historia'" class="book-fade-in book-centered">
        <div class="intro-book">
          <button class="close-btn" (click)="closeBook()" aria-label="Cerrar">×</button>
          <app-historia></app-historia>
        </div>
      </div>
      <div *ngIf="showBook && currentModule === 'Métodos'" class="book-fade-in book-centered">
        <div class="intro-book">
          <button class="close-btn" (click)="closeBook()" aria-label="Cerrar">×</button>
          <app-metodos></app-metodos>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./atlas.component.scss']
})
export class AtlasComponent {
  showBook = false;
  showQuestions = false;
  currentModule: string = '';
  questions = [
    {
      text: '¿Por qué los glaciares son considerados termómetros del clima?',
      options: [
        'Porque reflejan la temperatura del aire en su superficie',
        'Porque su retroceso o avance indica cambios climáticos',
        'Porque son fríos todo el año',
        'Porque producen agua potable'
      ],
      answer: 'Porque su retroceso o avance indica cambios climáticos',
      selected: '',
      answered: false
    },
    {
      text: '¿Qué relación tienen los pueblos indígenas con los hielos patagónicos?',
      options: [
        'Ninguna, no los conocían',
        'Solo los usaban para cazar',
        'Les atribuían carácter sagrado y espiritual',
        'Los consideraban peligrosos únicamente'
      ],
      answer: 'Les atribuían carácter sagrado y espiritual',
      selected: '',
      answered: false
    },
    {
      text: '¿Qué entiendes por Ngen y su vínculo con el agua?',
      options: [
        'Son espíritus protectores de la naturaleza, como el Ngen-Ko que cuida las aguas',
        'Son animales de la Patagonia',
        'Son glaciares antiguos',
        'Son rituales mapuche'
      ],
      answer: 'Son espíritus protectores de la naturaleza, como el Ngen-Ko que cuida las aguas',
      selected: '',
      answered: false
    },
    {
      text: '¿Cómo influye el retroceso glaciar en la vida local?',
      options: [
        'No tiene ningún efecto',
        'Aumenta la disponibilidad de agua',
        'Puede afectar el acceso al agua y los ecosistemas',
        'Hace el clima más frío'
      ],
      answer: 'Puede afectar el acceso al agua y los ecosistemas',
      selected: '',
      answered: false
    }
  ];
  stars = [
    { label: 'Introducción', x: 20, y: 40 },
    { label: 'Cosmovisión', x: 35, y: 25 },
    { label: 'Pueblos', x: 50, y: 50 },
    { label: 'Historia', x: 65, y: 30 },
    { label: 'Métodos', x: 80, y: 45 }
  ];
  constellationLines = [
    { x1: 20, y1: 40, x2: 35, y2: 25 },
    { x1: 35, y1: 25, x2: 50, y2: 50 },
    { x1: 50, y1: 50, x2: 65, y2: 30 },
    { x1: 65, y1: 30, x2: 80, y2: 45 }
  ];
  openBook(star: any) {
    this.showBook = true;
    this.currentModule = star.label;
    this.showQuestions = false;
  }
  answerQuestion(q: any) {
    q.answered = true;
  }
  goToQuestions() {
    this.showQuestions = true;
  }
  closeBook() {
    this.showBook = false;
    this.showQuestions = false;
    this.currentModule = '';
  }
}