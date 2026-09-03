import { authService } from '../../services/auth';
import { dbService } from '../../services/db';
import { auditService } from '../../services/audit';
import { notifyManager } from '../../services/notifications';
import {
  downloadRecording,
  downloadRecordingFromEvidence,
  persistRecording,
  resolveRecordingUrl,
  RECORDING_REF_PREFIX,
} from '../../services/recordings';
import { transitionClientTask } from '../../services/executionDeliveryConsumer';
import { ExecutionDeliveryError } from '../../application/executionDelivery';
import { resolveArticleSavePipelineSteps } from '../../domain/articleReviewCore';
import { VIDEO_SUBMIT_PIPELINE_TARGET } from '../../domain/videoSubmitCore';
import {
  MAX_RECORDING_DURATION_MS,
  RECORDING_VIDEO_BITS_PER_SECOND,
} from '../../domain/recordingLimits';
import { advanceContentPipelineTarget, pipelineActor } from '../../controllers/contentPipelineCommands';
import type { TeleprompterHandlerHost, TeleprompterHost } from './legacyAppHost';

export class TeleprompterController {
  private isTeleprompterPlaying = false;
  private teleprompterInterval: number | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingLimitTimer: number | null = null;
  private cameraStream: MediaStream | null = null;
  private previewBlob: Blob | null = null;
  private previewBlobUrl: string | null = null;

  constructor(private readonly host: TeleprompterHost) {}

  stopRecordingSession() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        /* noop */
      }
    }
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.previewBlob = null;
    this.revokePreviewUrl();

    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
      this.cameraStream = null;
    }

    const camera = document.getElementById('teleprompter-camera') as HTMLVideoElement | null;
    if (camera) camera.srcObject = null;
  }

  stopTeleprompter() {
    this.isTeleprompterPlaying = false;
    if (this.teleprompterInterval) {
      clearInterval(this.teleprompterInterval);
      this.teleprompterInterval = null;
    }
  }

  markVideoCaptureStarted(task: import('../../types').Task) {
    if (task.status === 'ASSIGNED' || task.status === 'VIEWED' || task.status === 'DRAFT') {
      try {
        transitionClientTask({
          requestedClientId: task.clientId,
          taskId: task.id,
          intent: 'start',
        });
      } catch {
        /* ya avanzada */
      }
    }
    if (task.contentItemId) {
      advanceContentPipelineTarget(
        this.host,
        task.contentItemId,
        'client_in_progress',
        'Cliente en teleprompter'
      );
    }
  }

  markArticleReviewStarted(task: import('../../types').Task, contentId: string): void {
    if (task.status === 'ASSIGNED' || task.status === 'VIEWED' || task.status === 'DRAFT') {
      try {
        transitionClientTask({
          requestedClientId: task.clientId,
          taskId: task.id,
          intent: 'start',
        });
      } catch {
        /* ya avanzada */
      }
    }
    const content = dbService.getContentById(contentId);
    if (!content) return;
    const steps = resolveArticleSavePipelineSteps(content);
    const actor = pipelineActor();
    for (const step of steps) {
      dbService.transitionContentPipeline(contentId, step, actor, 'Cliente revisando borrador');
    }
  }

  private setTeleprompterPhase(phase: 'record' | 'preview') {
    document.getElementById('teleprompter-phase-record')?.classList.toggle('hidden', phase === 'preview');
    document.getElementById('teleprompter-phase-preview')?.classList.toggle('hidden', phase !== 'preview');

    const camera = document.getElementById('teleprompter-camera') as HTMLVideoElement | null;
    const preview = document.getElementById('teleprompter-preview') as HTMLVideoElement | null;
    if (camera) camera.classList.toggle('hidden', phase === 'preview');
    if (preview) preview.classList.toggle('hidden', phase !== 'preview');
  }

  private revokePreviewUrl() {
    if (this.previewBlobUrl) {
      URL.revokeObjectURL(this.previewBlobUrl);
      this.previewBlobUrl = null;
    }
  }

  async initTeleprompterCamera() {
    const camera = document.getElementById('teleprompter-camera') as HTMLVideoElement | null;
    const hint = document.getElementById('teleprompter-camera-hint');
    if (!camera) return;

    try {
      if (!this.cameraStream) {
        this.cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: true,
        });
      }
      camera.srcObject = this.cameraStream;
      await camera.play();
      if (hint) hint.textContent = 'Cámara activa. Pulsa Grabar cuando estés listo.';
    } catch {
      if (hint) {
        hint.textContent = 'No se pudo acceder a la cámara. Revisa permisos del navegador.';
      }
      this.host.showToast('No se pudo acceder a la cámara o micrófono', 'warning');
    }
  }

  async startRecording() {
    const taskId = (this.host.modalData as { taskId?: string } | undefined)?.taskId;
    if (taskId) {
      const task = dbService.getAllTasks().find((t) => t.id === taskId);
      if (task) this.markVideoCaptureStarted(task);
    }

    if (!this.cameraStream) {
      await this.initTeleprompterCamera();
    }
    if (!this.cameraStream) return;

    this.recordedChunks = [];
    this.previewBlob = null;
    this.revokePreviewUrl();

    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : undefined;
      const recorderOptions: MediaRecorderOptions = {
        videoBitsPerSecond: RECORDING_VIDEO_BITS_PER_SECOND,
      };
      if (mimeType) recorderOptions.mimeType = mimeType;
      this.mediaRecorder = new MediaRecorder(this.cameraStream, recorderOptions);
    } catch {
      this.host.showToast('Tu navegador no soporta grabación de video aquí', 'warning');
      return;
    }

    this.mediaRecorder.ondataavailable = (ev) => {
      if (ev.data.size) this.recordedChunks.push(ev.data);
    };

    this.mediaRecorder.start(1000);
    if (this.recordingLimitTimer) window.clearTimeout(this.recordingLimitTimer);
    this.recordingLimitTimer = window.setTimeout(() => {
      void this.stopRecordingToPreview();
      this.host.showToast('Grabación detenida: máximo 10 minutos', 'warning');
    }, MAX_RECORDING_DURATION_MS);

    document.getElementById('btn-start-recording')?.classList.add('hidden');
    document.getElementById('btn-stop-recording')?.classList.remove('hidden');
    document.getElementById('teleprompter-recording-indicator')?.classList.remove('hidden');
    this.host.showToast('Grabando… (máx. 10 min)', 'info');
  }

  async stopRecordingToPreview() {
    if (this.recordingLimitTimer) {
      window.clearTimeout(this.recordingLimitTimer);
      this.recordingLimitTimer = null;
    }

    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      this.host.showToast('No hay una grabación activa', 'warning');
      return;
    }

    await new Promise<void>((resolve) => {
      const recorder = this.mediaRecorder!;
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    document.getElementById('btn-start-recording')?.classList.remove('hidden');
    document.getElementById('btn-stop-recording')?.classList.add('hidden');
    document.getElementById('teleprompter-recording-indicator')?.classList.add('hidden');

    const blob = this.recordedChunks.length
      ? new Blob(this.recordedChunks, { type: this.recordedChunks[0]?.type || 'video/webm' })
      : null;

    if (!blob || blob.size === 0) {
      this.host.showToast('La grabación quedó vacía. Intenta de nuevo.', 'warning');
      return;
    }

    this.previewBlob = blob;
    this.revokePreviewUrl();
    this.previewBlobUrl = URL.createObjectURL(blob);

    const preview = document.getElementById('teleprompter-preview') as HTMLVideoElement | null;
    if (preview) {
      preview.src = this.previewBlobUrl;
      await preview.play().catch(() => undefined);
    }

    this.setTeleprompterPhase('preview');
    this.stopTeleprompter();
    const playBtn = document.getElementById('btn-teleprompter-play');
    if (playBtn) playBtn.textContent = 'Iniciar desplazamiento';
  }

  retakeRecording() {
    this.previewBlob = null;
    this.revokePreviewUrl();
    this.recordedChunks = [];
    this.setTeleprompterPhase('record');

    const preview = document.getElementById('teleprompter-preview') as HTMLVideoElement | null;
    if (preview) {
      preview.pause();
      preview.removeAttribute('src');
      preview.load();
    }

    void this.initTeleprompterCamera();
  }

  async confirmSendRecording(taskId: string) {
    if (!this.previewBlob) {
      this.host.showToast('Graba un video antes de enviar', 'warning');
      return;
    }
    const sendBtn = document.getElementById('btn-confirm-send-recording') as HTMLButtonElement | null;
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Enviando…';
    }
    try {
      await this.submitClientVideo(taskId, this.previewBlob);
      this.stopTeleprompter();
      this.host.closeModal();
    } catch (error) {
      this.host.showToast(error instanceof Error ? error.message : 'No se pudo enviar el video', 'warning');
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Enviar video al manager';
      }
    }
  }

  private async submitClientVideo(taskId: string, blob: Blob) {
    const task = dbService.getAllTasks().find((t) => t.id === taskId);
    const client = task ? dbService.getClientById(task.clientId) : undefined;
    const organizationId = this.host.resolveOrganizationId(task?.clientId);
    if (!organizationId || !task?.clientId) {
      throw new Error('Cliente sin organizationId — no se puede enviar el video');
    }
    const ref = await persistRecording(
      organizationId,
      task.clientId,
      taskId,
      blob
    );
    // CR-1 #28 — teleprompter completion via TransitionClientTask (no direct dbService status write).
    transitionClientTask({
      requestedClientId: task.clientId,
      taskId,
      intent: 'complete',
      evidenceUrl: ref,
      clientNotes: 'Video enviado desde el teleprompter.',
    });
    if (task?.contentItemId) {
      advanceContentPipelineTarget(
        this.host,
        task.contentItemId,
        VIDEO_SUBMIT_PIPELINE_TARGET,
        'Video enviado por cliente'
      );
    }

    if (task?.clientId) {
      notifyManager(task.clientId, {
        type: 'CONTENT_REVIEW',
        title: 'Video recibido del cliente',
        body: client
          ? `${client.displayName} envió la grabación «${task.title || 'sin título'}».`
          : 'El cliente envió una nueva grabación de video.',
        href: 'ws-production',
        targetId: taskId,
      });
    }

    auditService.log(authService.getCurrentUser(), 'VIDEO_SUBMITTED', 'Task', taskId, {
      bytes: blob.size,
      contentId: task?.contentItemId,
    });

    this.host.showToast('Video enviado al manager', 'success');
  }

  async hydrateRecordingVideos() {
    const videos = document.querySelectorAll<HTMLVideoElement>('.task-recording-video[data-task-id]');
    await Promise.all(
      Array.from(videos).map(async (video) => {
        const taskId = video.getAttribute('data-task-id');
        if (!taskId || video.dataset.loaded === '1') return;
        const task = dbService.getAllTasks().find((t) => t.id === taskId);
        const evidenceUrl = task?.evidenceUrl || `${RECORDING_REF_PREFIX}${taskId}`;
        const url = await resolveRecordingUrl(evidenceUrl);
        if (!url) return;
        video.src = url;
        video.dataset.loaded = '1';
      })
    );
  }

  get isPlaying(): boolean {
    return this.isTeleprompterPlaying;
  }

  startTeleprompter() {
    this.isTeleprompterPlaying = true;
    const scrollArea = document.getElementById('teleprompter-scroll-area');
    const speedInput = document.getElementById('teleprompter-speed') as HTMLInputElement;
    const speed = speedInput ? parseInt(speedInput.value, 10) : 2;

    this.teleprompterInterval = window.setInterval(() => {
      if (!scrollArea) return;
      scrollArea.scrollTop += speed;
      if (scrollArea.scrollTop + scrollArea.clientHeight >= scrollArea.scrollHeight) {
        this.stopTeleprompter();
      }
    }, 40);
  }
}

export function bindTeleprompterHandlers(host: TeleprompterHandlerHost): void {
  document.querySelectorAll('.btn-open-teleprompter').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const taskId = (e.currentTarget as HTMLElement).getAttribute('data-task-id');
      if (!taskId) return;
      host.activeModal = 'teleprompter';
      host.modalData = { taskId };
      host.render();
    });
  });

  document.getElementById('btn-close-teleprompter')?.addEventListener('click', () => {
    host.closeModal();
  });

  const playBtn = document.getElementById('btn-teleprompter-play');
  playBtn?.addEventListener('click', () => {
    const tp = host.teleprompter as TeleprompterController;
    if (tp.isPlaying) {
      tp.stopTeleprompter();
      if (playBtn) playBtn.textContent = 'Iniciar desplazamiento';
    } else {
      tp.startTeleprompter();
      if (playBtn) playBtn.textContent = 'Pausar desplazamiento';
    }
  });

  document.getElementById('btn-start-recording')?.addEventListener('click', () => {
    void host.teleprompter.startRecording();
  });

  document.getElementById('btn-stop-recording')?.addEventListener('click', () => {
    void host.teleprompter.stopRecordingToPreview();
  });

  document.getElementById('btn-retake-recording')?.addEventListener('click', () => {
    host.teleprompter.retakeRecording();
  });

  document.getElementById('btn-confirm-send-recording')?.addEventListener('click', (e) => {
    const taskId = (e.currentTarget as HTMLElement).getAttribute('data-task-id');
    if (!taskId) return;
    void host.teleprompter.confirmSendRecording(taskId);
  });

  if (host.activeModal === 'teleprompter') {
    void host.teleprompter.initTeleprompterCamera();
  }

  document.querySelectorAll('.btn-download-recording').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const taskId = (e.currentTarget as HTMLElement).getAttribute('data-task-id');
      if (!taskId) return;
      const task = dbService.getAllTasks().find((t) => t.id === taskId);
      const filename = task ? `${task.title}.webm` : undefined;
      const ok = task?.evidenceUrl
        ? await downloadRecordingFromEvidence(task.evidenceUrl, filename)
        : await downloadRecording(taskId, filename);
      if (!ok) host.showToast('No hay video guardado para esta tarea', 'warning');
    });
  });

  document.querySelectorAll('.input-reupload-recording').forEach((input) => {
    input.addEventListener('change', async (e) => {
      const el = e.currentTarget as HTMLInputElement;
      const taskId = el.getAttribute('data-task-id');
      const file = el.files?.[0];
      if (!taskId || !file) return;
      const task = dbService.getAllTasks().find((t) => t.id === taskId);
      const organizationId = host.resolveOrganizationId(task?.clientId);
      if (!organizationId || !task?.clientId) {
        host.showToast('Cliente sin organizationId — no se puede subir el video', 'warning');
        return;
      }
      const ref = await persistRecording(
        organizationId,
        task.clientId,
        taskId,
        file
      );
      try {
        // CR-1 #28 — TransitionClientTask (attach_evidence).
        transitionClientTask({
          requestedClientId: task.clientId,
          taskId,
          intent: 'attach_evidence',
          evidenceUrl: ref,
          clientNotes: 'Versión re-subida por el manager.',
        });
        host.showToast('Video actualizado', 'success');
      } catch (error) {
        host.showToast(
          error instanceof ExecutionDeliveryError || error instanceof Error
            ? error.message
            : 'No se pudo actualizar la evidencia',
          'warning'
        );
      }
      el.value = '';
      host.render();
    });
  });

  void host.teleprompter.hydrateRecordingVideos();
}
