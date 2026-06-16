import {
  Component, inject, OnInit, OnDestroy,
  signal, ViewChild, ElementRef, NgZone,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil, interval, Subscription } from 'rxjs';
import { ExerciseService } from '../../../core/services/exercise.service';
import { SessionService } from '../../../core/services/session.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  ExerciseResponse,
  SessionResponse
} from '../../../core/models/session.model';

type SessionPhase =
  | 'SELECT'
  | 'INSTRUCTIONS'
  | 'CALIBRATION'
  | 'SESSION'
  | 'COMPLETED'
  | 'ERROR';

@Component({
  selector: 'app-session',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './session.html',
  styleUrls: ['./session.scss']
})
export class SessionComponent implements OnInit, OnDestroy, AfterViewInit {

  @ViewChild('videoEl') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasRef!: ElementRef<HTMLCanvasElement>;

  private exerciseService = inject(ExerciseService);
  private sessionService = inject(SessionService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  // ─── Signaux d'état ──────────────────────────────────────
  phase = signal<SessionPhase>('SELECT');
  exercises = signal<ExerciseResponse[]>([]);
  selectedEx = signal<ExerciseResponse | null>(null);
  currentSession = signal<SessionResponse | null>(null);
  completedSession = signal<SessionResponse | null>(null);
  currentStep = signal<number>(0);

  // Métriques
  isConformant = signal<boolean>(false);
  conformityPct = signal<number>(0);
  repsCompleted = signal<number>(0);
  calibCountdown = signal<number>(3);
  sessionTime = signal<number>(0);
  feedback = signal<string>('Positionnez-vous face à la caméra');
  errorMsg = signal<string>('');
  voiceEnabled = signal<boolean>(true);
  isDetected = signal<boolean>(false); // Indique si le corps est détecté

  // Animations / récompenses
  badgeUnlocked = signal<string | null>(null);
  xpGained = signal<number>(0);

  // ─── Étapes des instructions ──────────────────────────────
  readonly steps = [
    {
      icon: '📏',
      title: 'Positionnez-vous correctement',
      desc: 'Placez-vous à environ 1,5 mètre de la caméra. Votre corps entier doit être visible à l\'écran.'
    },
    {
      icon: '💡',
      title: 'Vérifiez l\'éclairage',
      desc: 'Assurez-vous d\'être bien éclairé de face. Évitez les contre-jours.'
    },
    {
      icon: '👕',
      title: 'Portez une tenue adaptée',
      desc: 'Des vêtements ajustés permettent à la caméra de mieux détecter vos articulations.'
    },
    {
      icon: '🎯',
      title: 'Votre exercice',
      desc: 'Lisez attentivement les paramètres ci-dessous avant de commencer.'
    }
  ];

  // ─── Variables privées ─────────────────────────────────────
  private pose: any = null;
  private camera: any = null;
  private scriptLoaded = false;
  private destroy$ = new Subject<void>();
  private sessionTimerSub: Subscription | null = null;
  private metricsIntervalSub: Subscription | null = null;

  // Calibration
  private calibBuffer: boolean[] = [];
  private readonly CALIB_WINDOW = 60;   // 60 frames ~ 2s à 30fps
  private readonly CALIB_THRESHOLD = 0.8; // 80% de conformité

  // Détection des répétitions
  private repPhase: 'NEUTRAL' | 'GOING_DOWN' | 'AT_BOTTOM' | 'GOING_UP' = 'NEUTRAL';
  private angleHistory: number[] = [];
  private lastAngle = 0;
  private readonly HISTORY_SIZE = 5;
  private readonly DIRECTION_THRESHOLD = 3; // degrés pour détecter un changement de direction

  // Variables de session
  private allScores: number[] = [];
  private frameAngles: Record<string, number> = {};
  private sessionEnded = false; // verrouille le traitement une fois l'objectif atteint
  private isProcessing = false; // évite les traitements concurrents

  // Feedback vocal
  private lastCorrectionTime = 0;
  private readonly CORRECTION_DELAY = 10000; // 10s entre les corrections
  private lastSpeakTime = 0;
  private lastSpokenMsg = '';

  // ─── Getter ────────────────────────────────────────────────
  get patientName(): string {
    return this.authService.getFullName() || 'Patient';
  }

  get progressPct(): number {
    const target = this.selectedEx()?.repsTarget ?? 10;
    return Math.min(100, Math.round((this.repsCompleted() / target) * 100));
  }

  // ─── Cycle de vie ──────────────────────────────────────────
  ngOnInit(): void {
    this.loadExercises();
  }

  ngAfterViewInit(): void {
    // Rien ici, l'initialisation se fait lors de la calibration
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopAll();
  }

  // ─── Chargement des exercices ──────────────────────────────
  loadExercises(): void {
    this.exerciseService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (exs) => this.exercises.set(exs),
        error: () => this.errorMsg.set('Impossible de charger les exercices.')
      });
  }

  selectExercise(ex: ExerciseResponse): void {
    this.selectedEx.set(ex);
  }

  // ─── Navigation des instructions ──────────────────────────
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

  // ─── Démarrer la séance ────────────────────────────────────
  startSession(): void {
    const ex = this.selectedEx();
    if (!ex) return;

    this.sessionService.start({ exerciseId: ex.id })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          this.currentSession.set(session);
          this.currentStep.set(0);
          this.phase.set('INSTRUCTIONS');
          this.resetState(); // Réinitialiser les variables de session
        },
        error: (err) => this.errorMsg.set(err.message || 'Erreur démarrage séance')
      });
  }

  // ─── Réinitialisation de l'état interne ──────────────────
  private resetState(): void {
    this.allScores = [];
    this.angleHistory = [];
    this.repPhase = 'NEUTRAL';
    this.lastAngle = 0;
    this.frameAngles = {};
    this.repsCompleted.set(0);
    this.conformityPct.set(0);
    this.sessionTime.set(0);
    this.sessionEnded = false;
    this.isProcessing = false;
    this.calibBuffer = [];
    this.calibCountdown.set(3);
    this.feedback.set('Positionnez-vous face à la caméra');
    this.isDetected.set(false);
    this.isConformant.set(false);
    // Annuler les timers précédents
    if (this.sessionTimerSub) {
      this.sessionTimerSub.unsubscribe();
      this.sessionTimerSub = null;
    }
    if (this.metricsIntervalSub) {
      this.metricsIntervalSub.unsubscribe();
      this.metricsIntervalSub = null;
    }
  }

  // ─── MediaPipe — Initialisation ───────────────────────────
  private async initMediaPipe(): Promise<void> {
    try {
      await this.loadMediaPipeScripts();
      await this.setupCamera();
      this.setupPose();
    } catch (err) {
      this.errorMsg.set('Impossible d\'accéder à la webcam. Vérifiez les permissions.');
      this.phase.set('ERROR');
    }
  }

  private loadMediaPipeScripts(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.scriptLoaded) {
        resolve();
        return;
      }
      const poseScript = document.createElement('script');
      poseScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
      poseScript.crossOrigin = 'anonymous';
      const camScript = document.createElement('script');
      camScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
      camScript.crossOrigin = 'anonymous';

      poseScript.onload = () => {
        document.body.appendChild(camScript);
        camScript.onload = () => {
          this.scriptLoaded = true;
          resolve();
        };
        camScript.onerror = () => reject(new Error('Camera utils failed'));
      };
      poseScript.onerror = () => reject(new Error('Pose script failed'));
      document.body.appendChild(poseScript);
    });
  }

  private async setupCamera(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 }
    });
    this.videoRef.nativeElement.srcObject = stream;
    await this.videoRef.nativeElement.play();
  }

  private setupPose(): void {
    const PoseClass = (window as any).Pose;
    if (!PoseClass) {
      this.errorMsg.set('MediaPipe Pose non disponible');
      this.phase.set('ERROR');
      return;
    }

    this.pose = new PoseClass({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    this.pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.75,
      minTrackingConfidence: 0.75
    });

    this.pose.onResults((results: any) => {
      this.ngZone.run(() => this.processResults(results));
    });

    const CameraClass = (window as any).Camera;
    if (!CameraClass) {
      this.errorMsg.set('MediaPipe Camera utils non disponible');
      this.phase.set('ERROR');
      return;
    }

    this.camera = new CameraClass(this.videoRef.nativeElement, {
      onFrame: async () => {
        if (this.pose) {
          await this.pose.send({ image: this.videoRef.nativeElement });
        }
      },
      width: 640,
      height: 480
    });
    this.camera.start();
  }

  // ─── Traitement des résultats MediaPipe ──────────────────
  private processResults(results: any): void {
    // Évite les traitements multiples
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const canvas = this.canvasRef.nativeElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      const landmarks = results.poseLandmarks;
      if (!landmarks) {
        this.isDetected.set(false);
        this.feedback.set('Patient non détecté. Reculez-vous ou ajustez votre position.');
        if (this.phase() === 'SESSION') {
          this.isConformant.set(false);
        }
        this.isProcessing = false;
        return;
      }
      this.isDetected.set(true);

      // Dessiner le squelette
      this.drawSkeleton(ctx, landmarks, canvas);

      const ex = this.selectedEx();
      if (!ex) {
        this.isProcessing = false;
        return;
      }

      // Calculer l'angle selon la zone corporelle
      const angle = this.calculateAngle(landmarks, ex.bodyZone);
      const diff = Math.abs(angle - ex.targetAngle);
      const conformant = diff <= ex.toleranceDeg;
      this.isConformant.set(conformant);
      this.frameAngles = { main_angle: angle };

      // Calibration
      if (this.phase() === 'CALIBRATION') {
        this.drawCalibrationGuide(ctx, canvas);
        this.handleCalibration(conformant);
        this.isProcessing = false;
        return;
      }

      // Session active
      if (this.phase() === 'SESSION' && !this.sessionEnded) {
        this.handleSession(angle, conformant, ex);
        this.drawFeedback(ctx, canvas, conformant);
      }

      // Mettre à jour le feedback si non détecté
      if (!this.isDetected() && this.phase() === 'SESSION') {
        this.feedback.set('Patient non détecté');
      }

    } catch (err) {
      console.error('Erreur dans processResults', err);
    } finally {
      this.isProcessing = false;
    }
  }

  // ─── Dessin du squelette ──────────────────────────────────
  private drawSkeleton(ctx: CanvasRenderingContext2D, landmarks: any[], canvas: HTMLCanvasElement): void {
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
      const end = landmarks[e];
      if (!start || !end) return;
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.7)';
      ctx.beginPath();
      ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
      ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
      ctx.stroke();
    });

    // Points articulaires
    [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].forEach(idx => {
      const lm = landmarks[idx];
      if (!lm) return;
      const x = lm.x * canvas.width;
      const y = lm.y * canvas.height;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.strokeStyle = 'rgba(99,102,241,1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });

    // Mettre en évidence l'articulation cible
    const targetLandmark = this.getTargetLandmarkIndex(this.selectedEx()?.bodyZone);
    if (targetLandmark !== null && landmarks[targetLandmark]) {
      const lm = landmarks[targetLandmark];
      const x = lm.x * canvas.width;
      const y = lm.y * canvas.height;
      ctx.strokeStyle = this.isConformant() ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = this.isConformant() ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)';
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  private drawCalibrationGuide(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
    if (this.calibBuffer.length > this.CALIB_WINDOW && this.calibBuffer.filter(v => v).length / this.calibBuffer.length >= this.CALIB_THRESHOLD) {
      return; // Calibration réussie, on n'affiche plus le guide
    }

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    ctx.save();
    ctx.strokeStyle = 'rgba(99,102,241,0.5)';
    ctx.fillStyle = 'rgba(99,102,241,0.08)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);

    // Tête
    ctx.beginPath();
    ctx.arc(cx, cy - 115, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Corps
    ctx.beginPath();
    ctx.rect(cx - 38, cy - 80, 76, 115);
    ctx.fill();
    ctx.stroke();

    // Jambes
    ctx.beginPath();
    ctx.moveTo(cx - 28, cy + 35);
    ctx.lineTo(cx - 28, cy + 130);
    ctx.moveTo(cx + 28, cy + 35);
    ctx.lineTo(cx + 28, cy + 130);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(99,102,241,0.95)';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Alignez-vous avec la silhouette', cx, cy + 158);
    ctx.restore();
  }

  private drawFeedback(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, conformant: boolean): void {
    ctx.strokeStyle = conformant ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)';
    ctx.lineWidth = 5;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  }

  // ─── Calibration ──────────────────────────────────────────
  private handleCalibration(conformant: boolean): void {
    this.calibBuffer.push(conformant);
    if (this.calibBuffer.length > this.CALIB_WINDOW) {
      this.calibBuffer.shift();
    }

    const stableRatio = this.calibBuffer.filter(v => v).length / this.calibBuffer.length;
    const progress = Math.min(1, stableRatio / this.CALIB_THRESHOLD);
    const countdown = Math.max(0, 3 - Math.floor(progress * 3));
    this.calibCountdown.set(countdown);

    if (stableRatio >= this.CALIB_THRESHOLD) {
      // Calibration réussie
      this.phase.set('SESSION');
      this.feedback.set('C\'est parti !');
      this.speak('Calibration réussie. L\'exercice commence.', 2000);
      this.startSessionTimer();
      this.startMetricsInterval();
    } else {
      if (conformant) {
        this.feedback.set(`Restez immobile... ${countdown}s`);
      } else {
        this.feedback.set('Ajustez votre position...');
        // Correction vocale espacée
        const now = Date.now();
        if (now - this.lastCorrectionTime > this.CORRECTION_DELAY) {
          this.speak('Alignez-vous avec la silhouette', 0);
          this.lastCorrectionTime = now;
        }
      }
    }
  }

  // ─── Session active ──────────────────────────────────────
  private handleSession(angle: number, conformant: boolean, ex: ExerciseResponse): void {
    // Calcul du score de conformité
    const diff = Math.abs(angle - ex.targetAngle);
    const score = conformant ? 100 : Math.max(0, 100 - (diff - ex.toleranceDeg) * 2);
    this.allScores.push(score);
    if (this.allScores.length > 100) this.allScores.shift(); // garder les 100 derniers
    const avg = this.allScores.reduce((a, b) => a + b, 0) / this.allScores.length;
    this.conformityPct.set(Math.round(avg));

    // Détection des répétitions
    const repDone = this.detectRepetition(angle, ex.targetAngle, ex.toleranceDeg);

    if (repDone) {
      const newReps = this.repsCompleted() + 1;
      this.repsCompleted.set(newReps);
      this.speak(`Répétition ${newReps}`, 1000);
      if (navigator.vibrate) navigator.vibrate(50);
    }

    // Feedback texte
    if (conformant) {
      this.feedback.set('Excellent — continuez !');
    } else {
      this.feedback.set(`Ciblez ${ex.targetAngle}° — actuel : ${Math.round(angle)}°`);
      // Correction vocale espacée
      const now = Date.now();
      if (now - this.lastCorrectionTime > this.CORRECTION_DELAY && !conformant) {
        this.speak(`Ciblez ${ex.targetAngle} degrés`, 0);
        this.lastCorrectionTime = now;
      }
    }

    // Vérification de l'objectif
    const target = ex.repsTarget ?? 10;
    if (this.repsCompleted() >= target && !this.sessionEnded) {
      this.sessionEnded = true;
      this.feedback.set('🎉 Objectif atteint ! Bravo !');
      this.speak('Objectif atteint ! Excellent travail !', 2000);
      setTimeout(() => this.completeSession(), 2500);
    }
  }

  // ─── Détection des répétitions améliorée ──────────────────
  private detectRepetition(angle: number, targetAngle: number, toleranceDeg: number): boolean {
    // Lissage
    this.angleHistory.push(angle);
    if (this.angleHistory.length > this.HISTORY_SIZE) this.angleHistory.shift();
    const smooth = this.angleHistory.reduce((a, b) => a + b, 0) / this.angleHistory.length;

    const inZone = Math.abs(smooth - targetAngle) <= toleranceDeg;
    const descending = smooth < this.lastAngle - this.DIRECTION_THRESHOLD;
    const ascending = smooth > this.lastAngle + this.DIRECTION_THRESHOLD;

    let repCompleted = false;

    switch (this.repPhase) {
      case 'NEUTRAL':
        if (descending) this.repPhase = 'GOING_DOWN';
        break;
      case 'GOING_DOWN':
        if (inZone) this.repPhase = 'AT_BOTTOM';
        break;
      case 'AT_BOTTOM':
        if (ascending) this.repPhase = 'GOING_UP';
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

  // ─── Calcul de l'angle selon la zone ──────────────────────
  private calculateAngle(landmarks: any[], bodyZone: string): number {
    // Index des landmarks selon la zone
    let hipIdx = 23, kneeIdx = 25, ankleIdx = 27; // par défaut genou gauche
    let shoulderIdx = 11, elbowIdx = 13, wristIdx = 15; // épaule gauche

    // Adapter selon la zone (on pourrait aussi utiliser le côté droit)
    // Pour simplifier, on utilise toujours le côté gauche
    switch (bodyZone) {
      case 'GENOU':
        hipIdx = 23; kneeIdx = 25; ankleIdx = 27;
        break;
      case 'EPAULE':
        shoulderIdx = 11; elbowIdx = 13; wristIdx = 15;
        break;
      case 'COUDE':
        shoulderIdx = 11; elbowIdx = 13; wristIdx = 15;
        break;
      case 'HANCHE':
        // On utilise l'angle entre épaule, hanche, genou
        hipIdx = 23; kneeIdx = 25; ankleIdx = 27; // pas idéal
        break;
      case 'DOS':
        // Angle du tronc : épaule, hanche, genou?
        hipIdx = 23; kneeIdx = 25; ankleIdx = 27;
        break;
      default:
        hipIdx = 23; kneeIdx = 25; ankleIdx = 27;
    }

    // Pour l'épaule/coude, on utilise les landmarks correspondants
    if (bodyZone === 'EPAULE' || bodyZone === 'COUDE') {
      const shoulder = landmarks[shoulderIdx];
      const elbow = landmarks[elbowIdx];
      const wrist = landmarks[wristIdx];
      if (!shoulder || !elbow || !wrist) return 0;
      return this.computeAngle(
        [shoulder.x, shoulder.y],
        [elbow.x, elbow.y],
        [wrist.x, wrist.y]
      );
    }

    // Pour les autres zones, on utilise la triade hanche-genou-cheville
    const hip = landmarks[hipIdx];
    const knee = landmarks[kneeIdx];
    const ankle = landmarks[ankleIdx];
    if (!hip || !knee || !ankle) return 0;
    return this.computeAngle(
      [hip.x, hip.y],
      [knee.x, knee.y],
      [ankle.x, ankle.y]
    );
  }

  private computeAngle(a: number[], b: number[], c: number[]): number {
    const rad = Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(a[1] - b[1], a[0] - b[0]);
    let angle = Math.abs(rad * 180 / Math.PI);
    if (angle > 180) angle = 360 - angle;
    return Math.round(angle);
  }

  private getTargetLandmarkIndex(bodyZone?: string): number | null {
    if (!bodyZone) return 25; // genou gauche par défaut
    switch (bodyZone) {
      case 'GENOU': return 25;
      case 'EPAULE': return 13; // coude gauche
      case 'COUDE': return 13;
      case 'HANCHE': return 23;
      case 'DOS': return 23;
      default: return 25;
    }
  }

  // ─── Timers et métriques ───────────────────────────────────
  private startSessionTimer(): void {
    this.sessionTime.set(0);
    this.sessionTimerSub = interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.ngZone.run(() => this.sessionTime.update(t => t + 1));
      });
  }

  private startMetricsInterval(): void {
    this.metricsIntervalSub = interval(5000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const session = this.currentSession();
        if (!session || this.sessionEnded) return;
        this.sessionService.saveMetrics(session.id, {
          jointAngles: JSON.stringify(this.frameAngles),
          conformityPct: this.conformityPct(),
          repsAtMoment: this.repsCompleted()
        }).pipe(takeUntil(this.destroy$))
          .subscribe({
            error: (err) => console.warn('Erreur sauvegarde métriques', err)
          });
      });
  }

  // ─── Feedback vocal ──────────────────────────────────────
  private speak(message: string, minDelay = 3000): void {
    if (!this.voiceEnabled()) return;
    const now = Date.now();
    if (message === this.lastSpokenMsg && now - this.lastSpeakTime < minDelay) {
      return;
    }
    this.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;
    this.speechSynthesis.speak(utterance);
    this.lastSpokenMsg = message;
    this.lastSpeakTime = now;
  }

  private get speechSynthesis(): SpeechSynthesis {
    return window.speechSynthesis;
  }

  toggleVoice(): void {
    this.voiceEnabled.update(v => !v);
    if (!this.voiceEnabled()) {
      this.speechSynthesis.cancel();
    }
  }

  // ─── Complétion / interruption ────────────────────────────
  completeSession(): void {
    const session = this.currentSession();
    if (!session || this.sessionEnded) return;
    this.sessionEnded = true; // sécurité

    this.stopAll(); // arrête les timers et la caméra

    this.sessionService.complete(session.id, {
      finalScore: this.conformityPct(),
      repsCompleted: this.repsCompleted(),
      jointAngles: JSON.stringify(this.frameAngles)
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.completedSession.set(result);
          this.xpGained.set(result.xpEarned ?? 0);
          this.phase.set('COMPLETED');
        },
        error: (err) => {
          this.errorMsg.set(err.message || 'Erreur complétion séance');
          this.phase.set('ERROR');
        }
      });
  }

  interruptSession(): void {
    const session = this.currentSession();
    this.stopAll();
    if (session) {
      this.sessionService.interrupt(session.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => this.router.navigate(['/patient/dashboard']),
          error: () => this.router.navigate(['/patient/dashboard'])
        });
    } else {
      this.router.navigate(['/patient/dashboard']);
    }
  }

  // ─── Arrêt des ressources ──────────────────────────────────
  private stopAll(): void {
    if (this.sessionTimerSub) {
      this.sessionTimerSub.unsubscribe();
      this.sessionTimerSub = null;
    }
    if (this.metricsIntervalSub) {
      this.metricsIntervalSub.unsubscribe();
      this.metricsIntervalSub = null;
    }
    try { this.camera?.stop(); } catch {}
    try { this.pose?.close(); } catch {}
    try { this.speechSynthesis.cancel(); } catch {}
    const video = this.videoRef?.nativeElement;
    if (video?.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
  }

  // ─── Helpers pour le template ─────────────────────────────
  getBadgeLabel(type: string): string {
    const labels: Record<string, string> = {
      'FIRST_SESSION': 'Première séance',
      'SEVEN_DAYS': '7 jours consécutifs',
      'FIFTY_REPS': '50 répétitions',
      'PERFECT_SCORE': 'Score parfait',
      'WEEK_GOAL': 'Objectif semaine',
      'PROGRAM_COMPLETE': 'Programme complet'
    };
    return labels[type] || type;
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  getLevelLabel(level: string): string {
    const labels: Record<string, string> = {
      'DEBUTANT': 'Débutant',
      'INTERMEDIAIRE': 'Intermédiaire',
      'AVANCE': 'Avancé'
    };
    return labels[level] || level;
  }

  getZoneLabel(zone: string): string {
    const labels: Record<string, string> = {
      'GENOU': 'Genou',
      'EPAULE': 'Épaule',
      'DOS': 'Dos',
      'HANCHE': 'Hanche',
      'COUDE': 'Coude'
    };
    return labels[zone] || zone;
  }

  goToDashboard(): void {
    this.router.navigate(['/patient/dashboard']);
  }

  logout(): void {
    this.authService.logout();
  }

  // Pour les calculs dans le template
  protected readonly Math = Math;
}