import {
  Component, inject, OnInit, OnDestroy,
  signal, ViewChild, ElementRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ExerciseService }
  from '../../../core/services/exercise.service';
import { SessionService }
  from '../../../core/services/session.service';
import { PatientService }
  from '../../../core/services/patient.service';
import { AuthService }
  from '../../../core/services/auth.service';
import {
  ExerciseResponse,
  SessionResponse
} from '../../../core/models/session.model';
import { PatientSidebarComponent }
  from '../../../shared/components/patient-sidebar/patient-sidebar.component';
import { RehabPlanService } from '../../../core/services/rehab-plan.service';

type SessionPhase =
  'SELECT'       |
  'INSTRUCTIONS' |
  'CALIBRATION'  |
  'SESSION'      |
  'COMPLETED'    |
  'ERROR';

@Component({
  selector: 'app-session',
  standalone: true,
  imports: [CommonModule, PatientSidebarComponent],
  templateUrl: './session.component.html',
  styleUrl: './session.component.scss'
})
export class SessionComponent
  implements OnInit, OnDestroy {

  @ViewChild('videoEl')
  videoRef!: ElementRef<HTMLVideoElement>;

  @ViewChild('canvasEl')
  canvasRef!: ElementRef<HTMLCanvasElement>;

  private exerciseService = inject(ExerciseService);
  private sessionService  = inject(SessionService);
  private authService     = inject(AuthService);
  private router          = inject(Router);
  private ngZone          = inject(NgZone);
  private rehabPlanService = inject(RehabPlanService);
  private patientService = inject(PatientService);

  // ══════════════════════════════════════════
  // SIGNAUX ÉTAT
  // ══════════════════════════════════════════
  activePlanId     = signal<string | null>(null);
  phase            = signal<SessionPhase>('SELECT');
  exercises        = signal<ExerciseResponse[]>([]);
  selectedEx       = signal<ExerciseResponse | null>(null);
  currentSession   = signal<SessionResponse | null>(null);
  completedSession = signal<SessionResponse | null>(null);
  currentStep      = signal<number>(0);

  // ── Métriques temps réel ───────────────────
  isConformant   = signal<boolean>(false);
  conformityPct  = signal<number>(0);
  repsCompleted  = signal<number>(0);
  calibCountdown = signal<number>(2);
  sessionTime    = signal<number>(0);
  feedback       = signal<string>(
    'Positionnez-vous face à la caméra');
  errorMsg       = signal<string>('');
  voiceEnabled   = signal<boolean>(true);

  // ── Animations ────────────────────────────
  badgeUnlocked = signal<string | null>(null);
  xpGained      = signal<number>(0);

  // ══════════════════════════════════════════
  // ÉTAPES INSTRUCTIONS
  // ══════════════════════════════════════════
  readonly steps = [
    {
      icon: '📏',
      title: 'Positionnez-vous correctement',
      desc:
        'Placez-vous à environ 1,5 mètre de la caméra.'
        + ' Votre corps entier doit être visible à'
        + ' l\'écran, des pieds jusqu\'à la tête.'
    },
    {
      icon: '💡',
      title: 'Vérifiez l\'éclairage',
      desc:
        'Assurez-vous d\'être bien éclairé de face.'
        + ' Évitez les contre-jours derrière vous.'
    },
    {
      icon: '👕',
      title: 'Portez une tenue adaptée',
      desc:
        'Des vêtements ajustés permettent à la caméra'
        + ' de mieux détecter vos articulations.'
    },
    {
      icon: '📝',
      title: 'Votre exercice',
      desc:
        'Lisez attentivement les paramètres de'
        + ' l\'exercice ci-dessous avant de commencer.'
    }
  ];

  // ══════════════════════════════════════════
  // MAPPING LANDMARKS MEDIAPIPE
  // ══════════════════════════════════════════
  private readonly LANDMARK_INDEX:
    Record<string, number> = {
    'NOSE': 0,
    'LEFT_SHOULDER': 11,  'RIGHT_SHOULDER': 12,
    'LEFT_ELBOW': 13,     'RIGHT_ELBOW': 14,
    'LEFT_WRIST': 15,     'RIGHT_WRIST': 16,
    'LEFT_HIP': 23,       'RIGHT_HIP': 24,
    'LEFT_KNEE': 25,      'RIGHT_KNEE': 26,
    'LEFT_ANKLE': 27,     'RIGHT_ANKLE': 28,
    'LEFT_EAR': 7,        'RIGHT_EAR': 8
  };

  // ✅ Nouveau — noms français des articulations
  // pour les messages de feedback précis
  private readonly JOINT_NAMES_FR:
    Record<number, string> = {
    11: 'épaule gauche',   12: 'épaule droite',
    13: 'coude gauche',    14: 'coude droit',
    15: 'poignet gauche',  16: 'poignet droit',
    23: 'hanche gauche',   24: 'hanche droite',
    25: 'genou gauche',    26: 'genou droit',
    27: 'cheville gauche', 28: 'cheville droite'
  };

  // ══════════════════════════════════════════
  // PRIVÉ
  // ══════════════════════════════════════════
  private pose: any = null;
  private camera: any = null;
  private metricsInterval:
    ReturnType<typeof setInterval> | null = null;
  private timerInterval:
    ReturnType<typeof setInterval> | null = null;
  private scriptLoaded = false;
  private calibStable = 0;
  private allScores: number[] = [];
  private frameAngles: Record<string, number> = {};
  private autoCompleting = false;

  // ── Algorithme répétitions ─────────────────
  private repPhase:
    'NEUTRAL'    |
    'GOING_DOWN' |
    'AT_BOTTOM'  |
    'GOING_UP'   = 'NEUTRAL';
  private angleHistory: number[] = [];
  private lastAngle = 0;
  private readonly HISTORY_SIZE = 5;

  // ── Speech ────────────────────────────────
  private readonly speech = window.speechSynthesis;
  private lastSpokenMsg = '';
  private lastSpeakTime = 0;
  private lastVisibilityWarning = 0;
  private startDirectionSpoken = false;   // ✅ Nouveau

  protected readonly Math = Math;


  private currentPatientLevel: string | null = null;

private loadCurrentLevel(): void {
  this.patientService.getMyProfile().subscribe({
    next: (profile) => {
      this.currentPatientLevel = profile.level;
    },
    error: (err: { message?: string }) => {
      console.error(
        'Impossible de charger le niveau du patient :',
        err.message || err);
    }
  });
}
  // ══════════════════════════════════════════
  // GETTERS
  // ══════════════════════════════════════════
  get patientName(): string {
    return this.authService.getFullName() || 'Patient';
  }
  get patientLevel(): string {
  return this.currentPatientLevel  || 'Inconnu'; ;
}

  get progressPct(): number {
    const target = this.selectedEx()?.repsTarget ?? 10;
    return Math.min(100,
      Math.round((this.repsCompleted() / target) * 100));
  }

  // ✅ Nouveau — niveau de feedback pour colorer
  // le badge à l'écran (vert / jaune / rouge)
  get feedbackLevel(): 'good' | 'close' | 'far' {
    if (this.isConformant()) return 'good';
    const msg = this.feedback();
    if (msg.includes('🟡')) return 'close';
    return 'far';
  }

  // ══════════════════════════════════════════
  // LIFECYCLE
  // ══════════════════════════════════════════
  ngOnInit(): void {
    this.loadExercises();
    this.loadActivePlanId();
    this.loadCurrentLevel();
  }

  ngOnDestroy(): void {
    this.stopAll();
  }

  // ══════════════════════════════════════════
  // EXERCICES
  // ══════════════════════════════════════════
  loadExercises(): void {
    this.exerciseService.getMyExercises().subscribe({
      next: (exs: ExerciseResponse[]) => {
        this.exercises.set(exs);
        if (exs.length === 0) {
          this.errorMsg.set(
            'Aucun exercice disponible pour le moment.'
            + ' Contactez votre kinésithérapeute.');
        }
      },
      error: (err: { message?: string }) => {
        this.errorMsg.set(
          err.message
          || 'Impossible de charger vos exercices.'
             + ' Contactez votre kinésithérapeute.');
      }
    });
  }

  selectExercise(ex: ExerciseResponse): void {
    this.selectedEx.set(ex);
  }

  getInstructions(): string[] {
    const ex = this.selectedEx();
    if (!ex) return [];

    const base: Record<string, string[]> = {
      'GENOU': [
        'Gardez le dos bien droit',
        'Contractez les abdominaux',
        'Fléchissez le genou lentement',
        'Revenez à la position initiale'
      ],
      'EPAULE': [
        'Gardez le dos droit',
        'Contractez les abdominaux',
        'Montez le bras à hauteur de l\'épaule',
        'Redescendez lentement'
      ],
      'DOS': [
        'Pieds écartés largeur d\'épaules',
        'Contractez les abdominaux',
        'Redressez le dos progressivement',
        'Maintenez 2 secondes en haut'
      ],
      'HANCHE': [
        'Gardez l\'équilibre',
        'Mouvements lents et contrôlés',
        'Ne dépassez pas la douleur',
        'Respirez régulièrement'
      ],
      'COUDE': [
        'Gardez le coude proche du corps',
        'Mouvements lents et précis',
        'Contractez le biceps',
        'Descendez lentement'
      ]
    };

    return base[ex.bodyZone] ?? [
      'Positionnez-vous correctement',
      'Mouvements lents et contrôlés',
      'Respirez régulièrement',
      'Arrêtez si douleur'
    ];
  }

  // ══════════════════════════════════════════
  // NAVIGATION INSTRUCTIONS
  // ══════════════════════════════════════════
  nextStep(): void {
    if (this.currentStep() < this.steps.length - 1) {
      this.currentStep.update(s => s + 1);
    } else {
      this.phase.set('CALIBRATION');
      this.initMediaPipe();
    }
  }

  prevStep(): void {
    if (this.currentStep() > 0) {
      this.currentStep.update(s => s - 1);
    }
  }

  private loadActivePlanId(): void {
    this.rehabPlanService.getMyActivePlan().subscribe({
      next: (plan) => this.activePlanId.set(plan.id),
      error: () => this.activePlanId.set(null)
    });
  }

  // ══════════════════════════════════════════
  // DÉMARRER SÉANCE
  // ══════════════════════════════════════════
  startSession(): void {
    const ex = this.selectedEx();
    if (!ex) return;

    if (!this.isValidJointConfig(ex)) {
      this.errorMsg.set(
        'Cet exercice n\'a pas de configuration'
        + ' MediaPipe valide. Contactez l\'administrateur.');
      return;
    }

    this.sessionService.start({
      exerciseId: ex.id,
      planId: this.activePlanId()
    }).subscribe({
      next: (session: SessionResponse) => {
        this.currentSession.set(session);
        this.currentStep.set(0);
        this.phase.set('INSTRUCTIONS');
      },
      error: (err: { message: string }) => {
        this.errorMsg.set(
          err.message || 'Erreur démarrage séance');
      }
    });
  }

  getToleranceLabel(
    toleranceDeg: number | undefined
  ): string {
    if (!toleranceDeg) return 'Précision modérée';
    if (toleranceDeg >= 15) return 'Mouvement souple accepté';
    if (toleranceDeg >= 8) return 'Précision modérée requise';
    return 'Mouvement précis demandé';
  }

  private isValidJointConfig(
    ex: ExerciseResponse
  ): boolean {
    if (!ex.mediapipeJoints) return false;
    const names = ex.mediapipeJoints
      .split(',').map(j => j.trim());
    if (names.length !== 3) return false;
    return names.every(
      name => this.LANDMARK_INDEX[name] !== undefined);
  }

  // ══════════════════════════════════════════
  // MEDIAPIPE — INITIALISATION
  // ══════════════════════════════════════════
  private async initMediaPipe(): Promise<void> {
    try {
      await this.loadMediaPipeScripts();
      await this.setupCamera();
      this.setupPose();
    } catch {
      this.errorMsg.set(
        'Impossible d\'accéder à la webcam.'
        + ' Vérifiez les permissions dans votre'
        + ' navigateur.');
      this.phase.set('ERROR');
    }
  }

  private loadMediaPipeScripts(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.scriptLoaded) {
        resolve();
        return;
      }
      const pose = document.createElement('script');
      pose.src =
        'https://cdn.jsdelivr.net/npm/'
        + '@mediapipe/pose/pose.js';
      pose.crossOrigin = 'anonymous';

      const cam = document.createElement('script');
      cam.src =
        'https://cdn.jsdelivr.net/npm/'
        + '@mediapipe/camera_utils/camera_utils.js';
      cam.crossOrigin = 'anonymous';

      pose.onload = () => {
        document.body.appendChild(cam);
        cam.onload = () => {
          this.scriptLoaded = true;
          resolve();
        };
        cam.onerror = () =>
          reject(new Error('Camera utils failed'));
      };
      pose.onerror = () =>
        reject(new Error('Pose script failed'));
      document.body.appendChild(pose);
    });
  }

  private async setupCamera(): Promise<void> {
    const stream = await navigator.mediaDevices
      .getUserMedia({
        video: { width: 640, height: 480 }
      });
    this.videoRef.nativeElement.srcObject = stream;
    await this.videoRef.nativeElement.play();
  }

  private setupPose(): void {
    const PoseClass = (window as any).Pose;
    if (!PoseClass) return;

    this.pose = new PoseClass({
      locateFile: (file: string) =>
        'https://cdn.jsdelivr.net/npm/'
        + `@mediapipe/pose/${file}`
    });

    this.pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6
    });

    this.pose.onResults((results: any) => {
      this.ngZone.run(() => {
        this.processResults(results);
      });
    });

    const CameraClass = (window as any).Camera;
    if (!CameraClass) return;

    this.camera = new CameraClass(
      this.videoRef.nativeElement,
      {
        onFrame: async () => {
          await this.pose.send({
            image: this.videoRef.nativeElement
          });
        },
        width: 640,
        height: 480
      }
    );
    this.camera.start();
  }

  // ══════════════════════════════════════════
  // MAPPING ARTICULATION DYNAMIQUE
  // ══════════════════════════════════════════

  /**
   * Retourne les 3 indices de landmarks MediaPipe
   * correspondant à l'exercice sélectionné.
   * Format mediapipeJoints : "PointA,Sommet,PointC"
   * Le point central (index 1) est l'articulation
   * dont l'angle est mesuré et affiché à l'écran.
   */
  private getJointIndices(): number[] | null {
    const ex = this.selectedEx();
    if (!ex?.mediapipeJoints) return null;

    const jointNames = ex.mediapipeJoints
      .split(',')
      .map(j => j.trim());

    if (jointNames.length !== 3) return null;

    const indices = jointNames.map(
      name => this.LANDMARK_INDEX[name]);

    if (indices.some(idx => idx === undefined)) {
      return null;
    }

    return indices;
  }

  // ══════════════════════════════════════════
  // IDENTIFICATION PARTIE DU CORPS MANQUANTE
  // ══════════════════════════════════════════
  // Permet de dire au patient PRÉCISÉMENT quelle
  // articulation n'est plus visible, plutôt qu'un
  // message générique "replacez-vous"
  private getMissingBodyPart(
    landmarks: any[],
    jointIndices: number[]
  ): string {
    for (const idx of jointIndices) {
      const lm = landmarks[idx];
      if (!lm || (lm.visibility ?? 0) < 0.6) {
        return this.JOINT_NAMES_FR[idx]
          || 'une partie de votre corps';
      }
    }
    return 'votre corps';
  }

  // ══════════════════════════════════════════
  // TRAITEMENT RÉSULTATS MEDIAPIPE
  // ══════════════════════════════════════════
  private processResults(results: any): void {
    if (!results.poseLandmarks) return;

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      results.image, 0, 0,
      canvas.width, canvas.height);

    const ex = this.selectedEx();
    if (!ex) return;

    // Vérifier la configuration articulaire
    // avant tout traitement
    const indices = this.getJointIndices();
    if (!indices) {
      this.feedback.set(
        '⚠️ Configuration articulation manquante');
      return;
    }

    this.drawSkeleton(
      ctx, results.poseLandmarks, canvas, indices);

    // Phase calibration — vérifie juste la visibilité
    // du corps, pas un angle précis
    if (this.phase() === 'CALIBRATION') {
      const bodyVisible = this.checkBodyVisibility(
        results.poseLandmarks);
      this.drawCalibrationGuide(ctx, canvas);
      this.handleCalibration(bodyVisible);
      return;
    }

    // Phase séance — angle précis requis, calculé
    // sur l'articulation propre à CET exercice
    if (this.phase() === 'SESSION') {

      // Vérification — l'articulation cible doit
      // être réellement visible, pas juste une
      // position devinée par MediaPipe
      const jointsVisible = this.areTrackedJointsVisible(
        results.poseLandmarks, indices);

      if (!jointsVisible) {
        // ✅ Identifie précisément la partie manquante
        const missingPart = this.getMissingBodyPart(
          results.poseLandmarks, indices);

        this.feedback.set(
          `⚠️ Je ne vois plus votre ${missingPart}`
          + ` — replacez-vous face à la caméra`);
        this.isConformant.set(false);
        this.drawFeedback(ctx, canvas, false);

        // Reset de la machine à états — empêche
        // un faux positif si le patient cache puis
        // remontre l'articulation en plein mouvement
        this.repPhase = 'NEUTRAL';
        this.angleHistory = [];

        // Alerte vocale anti-spam — un seul rappel
        // toutes les 4 secondes
        const now = Date.now();
        if (now - this.lastVisibilityWarning > 4000) {
          this.speak(
            `Je ne vois plus votre ${missingPart}`);
          this.lastVisibilityWarning = now;
        }

        return; // Pas de calcul d'angle, pas de
                // comptage de répétition
      }

      const angle = this.calculateAngle(
        results.poseLandmarks, indices);
      const diff = Math.abs(angle - ex.targetAngle);
      const conformant = diff <= ex.toleranceDeg;

      this.frameAngles = { main_angle: angle };
      this.isConformant.set(conformant);

      this.handleSession(angle, conformant, ex);
      this.drawFeedback(ctx, canvas, conformant);
    }
  }

  // ══════════════════════════════════════════
  // VÉRIFICATION VISIBILITÉ CORPS (calibration)
  // ══════════════════════════════════════════
  private checkBodyVisibility(
    landmarks: any[]
  ): boolean {
    const required = [11, 12, 23, 24, 25, 26];
    const threshold = 0.5;

    return required.every(idx => {
      const lm = landmarks[idx];
      return lm && (lm.visibility ?? 1) > threshold;
    });
  }

  // ══════════════════════════════════════════
  // VÉRIFICATION VISIBILITÉ ARTICULATION CIBLE
  // (phase SESSION uniquement)
  // ══════════════════════════════════════════
  private areTrackedJointsVisible(
    landmarks: any[],
    jointIndices: number[]
  ): boolean {
    const VISIBILITY_THRESHOLD = 0.6;

    return jointIndices.every(idx => {
      const lm = landmarks[idx];
      return lm && (lm.visibility ?? 0)
        >= VISIBILITY_THRESHOLD;
    });
  }

  // ══════════════════════════════════════════
  // DESSIN SQUELETTE
  // ══════════════════════════════════════════
  private drawSkeleton(
    ctx: CanvasRenderingContext2D,
    landmarks: any[],
    canvas: HTMLCanvasElement,
    jointIndices: number[]
  ): void {

    const connections = [
      [11, 12], [11, 23], [12, 24], [23, 24],
      [11, 13], [13, 15],
      [12, 14], [14, 16],
      [23, 25], [25, 27],
      [24, 26], [26, 28]
    ];

    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    connections.forEach(([s, e]) => {
      const start = landmarks[s];
      const end   = landmarks[e];
      if (!start || !end) return;

      ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
      ctx.beginPath();
      ctx.moveTo(
        start.x * canvas.width,
        start.y * canvas.height);
      ctx.lineTo(
        end.x * canvas.width,
        end.y * canvas.height);
      ctx.stroke();
    });

    [11, 12, 13, 14, 15, 16,
     23, 24, 25, 26, 27, 28]
    .forEach(idx => {
      const lm = landmarks[idx];
      if (!lm) return;
      const x = lm.x * canvas.width;
      const y = lm.y * canvas.height;

      ctx.fillStyle   = 'rgba(255,255,255,0.9)';
      ctx.strokeStyle = 'rgba(59,130,246,1)';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });

    // Articulation cible — DYNAMIQUE selon l'exercice
    // jointIndices[1] = le sommet de l'angle mesuré
    // (genou pour exercice genou, épaule pour exercice
    // épaule, etc.)
    const targetIdx = jointIndices[1];
    const target = landmarks[targetIdx];

    if (target) {
      const x = target.x * canvas.width;
      const y = target.y * canvas.height;

      ctx.strokeStyle = this.isConformant()
        ? 'rgba(34,197,94,0.5)'
        : 'rgba(239,68,68,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.fillStyle = this.isConformant()
        ? 'rgba(34,197,94,0.9)'
        : 'rgba(239,68,68,0.9)';
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  private drawCalibrationGuide(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement
  ): void {
    if (this.calibStable > 25) return;

    const cx = canvas.width  / 2;
    const cy = canvas.height / 2;

    ctx.save();
    ctx.strokeStyle = 'rgba(59,130,246,0.5)';
    ctx.fillStyle   = 'rgba(59,130,246,0.08)';
    ctx.lineWidth   = 2;
    ctx.setLineDash([6, 4]);

    ctx.beginPath();
    ctx.arc(cx, cy - 115, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.rect(cx - 38, cy - 80, 76, 115);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 28, cy + 35);
    ctx.lineTo(cx - 28, cy + 130);
    ctx.moveTo(cx + 28, cy + 35);
    ctx.lineTo(cx + 28, cy + 130);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle   = 'rgba(59,130,246,0.95)';
    ctx.font        = 'bold 13px sans-serif';
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      'Placez votre corps dans le cadre',
      cx, cy + 158);

    ctx.restore();
  }

  private drawFeedback(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    conformant: boolean
  ): void {
    ctx.strokeStyle = conformant
      ? 'rgba(34,197,94,0.9)'
      : 'rgba(239,68,68,0.9)';
    ctx.lineWidth = 5;
    ctx.strokeRect(2, 2,
      canvas.width - 4, canvas.height - 4);
  }

  // ══════════════════════════════════════════
  // CALIBRATION — ASSOUPLIE
  // ══════════════════════════════════════════
  private handleCalibration(
    bodyVisible: boolean
  ): void {
    if (bodyVisible) {
      this.calibStable++;
      const countdown = Math.max(0,
        2 - Math.floor(this.calibStable / 25));
      this.calibCountdown.set(countdown);

      if (this.calibStable >= 50) {
        this.phase.set('SESSION');
        this.startSessionTimer();
        this.startMetricsInterval();
        this.feedback.set('C\'est parti !');
        this.speak('Calibration réussie.'
          + ' L\'exercice commence.');
      } else {
        this.feedback.set(
          `Restez visible... ${countdown}s`);
      }
    } else {
      this.calibStable = Math.max(0,
        this.calibStable - 3);
      this.calibCountdown.set(2);
      this.feedback.set(
        'Placez votre corps entier dans le cadre');
    }
  }

  // ══════════════════════════════════════════
  // SÉANCE ACTIVE
  // ══════════════════════════════════════════
  private handleSession(
    angle: number,
    conformant: boolean,
    ex: ExerciseResponse
  ): void {

    const diff = Math.abs(angle - ex.targetAngle);
    const score = conformant
      ? 100
      : Math.max(0,
          100 - (diff - ex.toleranceDeg) * 2);

    this.allScores.push(score);
    const avg = this.allScores
      .reduce((a, b) => a + b, 0)
      / this.allScores.length;
    this.conformityPct.set(Math.round(avg));

    const repDone = this.detectRepetition(
      angle, ex.targetAngle, ex.toleranceDeg);

    if (repDone) {
      const newReps = this.repsCompleted() + 1;
      this.repsCompleted.set(newReps);
      this.speak(`Répétition ${newReps}`);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      // ✅ Réinitialise pour permettre un nouveau
      // rappel de direction au prochain cycle
      this.startDirectionSpoken = false;
    }

    // ✅ Feedback à 3 paliers — vert / jaune / rouge
    // au lieu de juste conforme/non conforme
    if (conformant) {
      this.feedback.set('✅ Parfait, maintenez !');
    } else if (diff <= ex.toleranceDeg * 1.5) {
      this.feedback.set('🟡 Presque... continuez');
    } else {
      const direction = angle < ex.targetAngle
        ? '⬆️ Pliez davantage'
        : '⬇️ Redressez légèrement';
      this.feedback.set(direction);
    }

    // ✅ Direction explicite une seule fois au
    // démarrage de chaque nouveau cycle de mouvement
    if (this.repPhase === 'NEUTRAL'
        && !this.startDirectionSpoken) {
      this.speak('Pliez doucement jusqu\'au repère');
      this.startDirectionSpoken = true;
    }

    const target = ex.repsTarget ?? 10;
    if (this.repsCompleted() >= target
        && !this.autoCompleting) {
      this.autoCompleting = true;

      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
        this.metricsInterval = null;
      }

      this.feedback.set('🎉 Objectif atteint ! Bravo !');
      this.speak(
        'Objectif atteint ! Excellent travail !');
      setTimeout(() => this.completeSession(), 2500);
    }
  }

  // ══════════════════════════════════════════
  // ALGORITHME RÉPÉTITIONS PAR PHASES
  // ══════════════════════════════════════════
  private detectRepetition(
    angle: number,
    targetAngle: number,
    toleranceDeg: number
  ): boolean {

    this.angleHistory.push(angle);
    if (this.angleHistory.length
        > this.HISTORY_SIZE) {
      this.angleHistory.shift();
    }
    const smooth = this.angleHistory
      .reduce((a, b) => a + b, 0)
      / this.angleHistory.length;

    const inZone = Math.abs(
      smooth - targetAngle) <= toleranceDeg;
    const descending = smooth < this.lastAngle - 2;
    const ascending  = smooth > this.lastAngle + 2;

    let repCompleted = false;

    switch (this.repPhase) {
      case 'NEUTRAL':
        if (descending) {
          this.repPhase = 'GOING_DOWN';
        }
        break;
      case 'GOING_DOWN':
        if (inZone) {
          this.repPhase = 'AT_BOTTOM';
        }
        break;
      case 'AT_BOTTOM':
        if (ascending) {
          this.repPhase = 'GOING_UP';
        }
        break;
      case 'GOING_UP':
        if (!inZone && ascending) {
          repCompleted = true;
          this.repPhase = 'NEUTRAL';
        }
        break;
    }

    this.lastAngle = smooth;
    return repCompleted;
  }

  // ══════════════════════════════════════════
  // CALCUL ANGLE ARTICULAIRE — DYNAMIQUE
  // ══════════════════════════════════════════
  private calculateAngle(
    landmarks: any[],
    jointIndices: number[]
  ): number {
    const [aIdx, bIdx, cIdx] = jointIndices;
    const a = landmarks[aIdx];
    const b = landmarks[bIdx];
    const c = landmarks[cIdx];

    if (!a || !b || !c) return 0;

    return this.computeAngle(
      [a.x, a.y],
      [b.x, b.y],
      [c.x, c.y]
    );
  }

  private computeAngle(
    a: number[],
    b: number[],
    c: number[]
  ): number {
    const rad =
      Math.atan2(c[1] - b[1], c[0] - b[0])
      - Math.atan2(a[1] - b[1], a[0] - b[0]);
    let angle = Math.abs(rad * 180 / Math.PI);
    if (angle > 180) angle = 360 - angle;
    return Math.round(angle);
  }

  // ══════════════════════════════════════════
  // TIMERS ET MÉTRIQUES
  // ══════════════════════════════════════════
  private startSessionTimer(): void {
    this.sessionTime.set(0);
    this.timerInterval = setInterval(() => {
      this.ngZone.run(() => {
        this.sessionTime.update(t => t + 1);
      });
    }, 1000);
  }

  private startMetricsInterval(): void {
    this.metricsInterval = setInterval(() => {
      const session = this.currentSession();
      if (!session) return;

      this.sessionService.saveMetrics(
        session.id,
        {
          jointAngles: JSON.stringify(
            this.frameAngles),
          conformityPct: this.conformityPct(),
          repsAtMoment: this.repsCompleted()
        }
      ).subscribe();
    }, 5000);
  }

  // ══════════════════════════════════════════
  // FEEDBACK VOCAL
  // ══════════════════════════════════════════
  private speak(message: string): void {
    if (!this.voiceEnabled()) return;

    const now = Date.now();
    if (message === this.lastSpokenMsg
        && now - this.lastSpeakTime < 3000) {
      return;
    }

    this.speech.cancel();
    const utterance =
      new SpeechSynthesisUtterance(message);
    utterance.lang   = 'fr-FR';
    utterance.rate   = 0.9;
    utterance.pitch  = 1.0;
    utterance.volume = 0.8;
    this.speech.speak(utterance);

    this.lastSpokenMsg = message;
    this.lastSpeakTime = now;
  }

  toggleVoice(): void {
    this.voiceEnabled.update(v => !v);
    if (!this.voiceEnabled()) {
      this.speech.cancel();
    }
  }

  // ══════════════════════════════════════════
  // COMPLÉTION / INTERRUPTION
  // ══════════════════════════════════════════
  completeSession(): void {
    const session = this.currentSession();
    if (!session) return;

    this.stopAll();

    this.sessionService.complete(session.id, {
      finalScore: this.conformityPct(),
      repsCompleted: this.repsCompleted(),
      jointAngles: JSON.stringify(this.frameAngles)
    }).subscribe({
      next: (result: SessionResponse) => {
        this.completedSession.set(result);
        this.xpGained.set(result.xpEarned ?? 0);
        this.phase.set('COMPLETED');
      },
      error: (err: { message: string }) => {
        this.errorMsg.set(
          err.message || 'Erreur complétion séance');
      }
    });
  }

  interruptSession(): void {
    const session = this.currentSession();
    this.stopAll();

    if (session) {
      this.sessionService
        .interrupt(session.id)
        .subscribe({
          next: () => this.router.navigate(
            ['/patient/dashboard']),
          error: () => this.router.navigate(
            ['/patient/dashboard'])
        });
    } else {
      this.router.navigate(['/patient/dashboard']);
    }
  }

  // ══════════════════════════════════════════
  // HELPERS TEMPLATE
  // ══════════════════════════════════════════
  getBadgeLabel(type: string): string {
    const labels: Record<string, string> = {
      'FIRST_SESSION':    'Première séance',
      'SEVEN_DAYS':       '7 jours consécutifs',
      'FIFTY_REPS':       '50 répétitions',
      'PERFECT_SCORE':    'Score parfait',
      'WEEK_GOAL':        'Objectif semaine',
      'PROGRAM_COMPLETE': 'Programme complet'
    };
    return labels[type] || type;
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
      .toString().padStart(2, '0');
    const s = (seconds % 60)
      .toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  getLevelLabel(level: string): string {
    const labels: Record<string, string> = {
      'DEBUTANT':      'Débutant',
      'INTERMEDIAIRE': 'Intermédiaire',
      'AVANCE':        'Avancé'
    };
    return labels[level] || level;
  }

  getZoneLabel(zone: string): string {
    const labels: Record<string, string> = {
      'GENOU':  'Genou',
      'EPAULE': 'Épaule',
      'DOS':    'Dos',
      'HANCHE': 'Hanche',
      'COUDE':  'Coude'
    };
    return labels[zone] || zone;
  }

  goToDashboard(): void {
    this.router.navigate(['/patient/dashboard']);
  }

  logout(): void {
    this.authService.logout();
  }

  // ══════════════════════════════════════════
  // NETTOYAGE
  // ══════════════════════════════════════════
  private stopAll(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    try { this.camera?.stop(); } catch {}
    try { this.pose?.close(); } catch {}
    try { this.speech.cancel(); } catch {}

    const video = this.videoRef?.nativeElement;
    if (video?.srcObject) {
      (video.srcObject as MediaStream)
        .getTracks()
        .forEach(t => t.stop());
    }
  }
}