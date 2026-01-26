const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

class KakaoAutomationService {
  constructor(options = {}) {
    this.commandTimeoutMs = options.commandTimeoutMs || 60000;
    this.helperPath = this.resolveHelperPath();
  }

  resolveHelperPath() {
    const envPath = process.env.KAKAO_HELPER_PATH;
    const localPath = path.join(__dirname, 'KakaoSendHelper.exe');
    const candidates = [envPath, localPath]
      .filter(Boolean)
      .map((candidate) => String(candidate).trim());
    for (const candidate of candidates) {
      try {
        if (candidate && fs.existsSync(candidate)) return candidate;
      } catch {}
    }
    return null;
  }

  async sendBatch(payload = {}) {
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      return { success: false, message: '전송할 항목이 없습니다.' };
    }
    console.log('[KAKAO] helperPath:', this.helperPath);
    console.log('[KAKAO] helperPath raw:', JSON.stringify(this.helperPath), 'len:', this.helperPath ? this.helperPath.length : 0, 'cwd:', process.cwd());
    if (!this.helperPath) {
      return {
        success: false,
        message: 'KakaoSendHelper.exe를 찾을 수 없습니다. README_KakaoSendHelper.txt를 참고해 빌드하세요.',
      };
    }

    const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const inputPath = path.join(os.tmpdir(), `kakao_send_${stamp}.json`);
    const outputPath = path.join(os.tmpdir(), `kakao_send_${stamp}_out.json`);
    fs.writeFileSync(inputPath, JSON.stringify({ items: payload.items }), 'utf8');

    try {
      const result = await this.runHelper(inputPath, outputPath);
      return result;
    } catch (err) {
      return { success: false, message: err?.message || String(err) };
    } finally {
      try { fs.unlinkSync(inputPath); } catch {}
      try { fs.unlinkSync(outputPath); } catch {}
    }
  }

  runHelper(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      const spawnHelper = (useCmdFallback = false) => {
        if (!useCmdFallback) {
          return spawn(this.helperPath, [inputPath, outputPath], { windowsHide: true, shell: false });
        }
        const quoted = `"${this.helperPath}" "${inputPath}" "${outputPath}"`;
        return spawn('cmd.exe', ['/c', quoted], { windowsHide: true, shell: false });
      };
      let proc = spawnHelper(false);
      let stderr = '';
      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error('KakaoSendHelper 실행이 시간 초과되었습니다.'));
      }, this.commandTimeoutMs);
      proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      proc.on('error', (err) => {
        if (err && err.code === 'ENOENT') {
          try {
            proc = spawnHelper(true);
            proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
            proc.on('error', (fallbackErr) => {
              clearTimeout(timer);
              reject(fallbackErr);
            });
            proc.on('close', (code) => {
              clearTimeout(timer);
              if (code !== 0) {
                reject(new Error(stderr.trim() || `KakaoSendHelper 실패 (code ${code})`));
                return;
              }
              try {
                const raw = fs.readFileSync(outputPath, 'utf8');
                const data = JSON.parse(raw);
                resolve({ success: true, results: data?.results || [] });
              } catch (readErr) {
                reject(readErr);
              }
            });
            return;
          } catch {}
        }
        clearTimeout(timer);
        reject(err);
      });
      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(stderr.trim() || `KakaoSendHelper 실패 (code ${code})`));
          return;
        }
        try {
          const raw = fs.readFileSync(outputPath, 'utf8');
          const data = JSON.parse(raw);
          resolve({ success: true, results: data?.results || [] });
        } catch (err) {
          reject(err);
        }
      });
    });
  }
}

module.exports = { KakaoAutomationService };
