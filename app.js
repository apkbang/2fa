(() => {
  const form = document.getElementById('secret-form');
  const secretInput = document.getElementById('secret');
  const visibilityButton = document.getElementById('visibility');
  const result = document.getElementById('result');
  const status = document.getElementById('status');
  const seconds = document.getElementById('seconds');
  const timer = document.getElementById('timer');
  const error = document.getElementById('error');
  const codeElements = {
    previous: document.getElementById('code-previous'),
    current: document.getElementById('code-current'),
    next: document.getElementById('code-next'),
  };
  const copyButtons = [...document.querySelectorAll('[data-copy]')];
  const agentBadge = document.getElementById('agent-badge');

  let activeKey = null;
  let activeCounter = -1;
  let rawCodes = { previous: '', current: '', next: '' };
  let requestId = 0;

  if (window.apkbangAgentCode) agentBadge.hidden = false;

  const showError = (message) => {
    error.textContent = message;
    error.hidden = false;
  };

  const clearError = () => {
    error.textContent = '';
    error.hidden = true;
  };

  const updateRemainingTime = (remaining) => {
    seconds.textContent = String(remaining);
    timer.classList.toggle('is-safe', remaining >= 10);
    timer.classList.toggle('is-warning', remaining >= 5 && remaining < 10);
    timer.classList.toggle('is-danger', remaining < 5);
  };

  const resetResult = () => {
    requestId += 1;
    activeKey = null;
    activeCounter = -1;
    rawCodes = { previous: '', current: '', next: '' };
    status.textContent = '等待输入密钥';
    for (const element of Object.values(codeElements)) element.textContent = '--- ---';
    for (const button of copyButtons) {
      button.disabled = true;
      button.textContent = '复制';
    }
    result.classList.add('is-empty');
    updateRemainingTime(30);
    clearError();
  };

  const normalizeSecret = (input) => {
    let secret = input.trim();
    if (/^otpauth:\/\//i.test(secret)) {
      let uri;
      try {
        uri = new URL(secret);
      } catch (_) {
        throw new Error('otpauth 链接格式不正确，请重新复制完整链接。');
      }
      if (uri.hostname.toLowerCase() !== 'totp') {
        throw new Error('当前仅支持 TOTP 动态验证码链接。');
      }
      if ((uri.searchParams.get('algorithm') || 'SHA1').toUpperCase().replace('-', '') !== 'SHA1'
        || Number(uri.searchParams.get('digits') || 6) !== 6
        || Number(uri.searchParams.get('period') || 30) !== 30) {
        throw new Error('当前仅支持 SHA-1、6 位、30 秒的 TOTP 密钥。');
      }
      secret = uri.searchParams.get('secret') || '';
      if (!secret) throw new Error('otpauth 链接中没有找到密钥。');
    }
    secret = secret.toUpperCase().replace(/[\s=-]/g, '');
    if (secret.length < 8) throw new Error('密钥过短，请输入完整的 2FA 密钥。');
    if (!/^[A-Z2-7]+$/.test(secret)) {
      throw new Error('密钥格式不正确，仅支持 Base32 字母 A-Z 和数字 2-7。');
    }
    return secret;
  };

  const decodeBase32 = (secret) => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    const bytes = [];
    for (const character of secret) {
      value = (value << 5) | alphabet.indexOf(character);
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
        value &= (1 << bits) - 1;
      }
    }
    return new Uint8Array(bytes);
  };

  const generateCode = async (key, counter) => {
    const counterBytes = new ArrayBuffer(8);
    const view = new DataView(counterBytes);
    view.setUint32(0, Math.floor(counter / 0x100000000), false);
    view.setUint32(4, counter >>> 0, false);
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes));
    const offset = signature[signature.length - 1] & 15;
    const binary = (((signature[offset] & 127) << 24)
      | (signature[offset + 1] << 16)
      | (signature[offset + 2] << 8)
      | signature[offset + 3]) >>> 0;
    return String(binary % 1000000).padStart(6, '0');
  };

  const refresh = async () => {
    const now = Math.floor(Date.now() / 1000);
    const counter = Math.floor(now / 30);
    if (!activeKey) return;
    updateRemainingTime(30 - (now % 30));
    if (counter === activeCounter) return;
    const currentRequest = ++requestId;
    try {
      const generated = await Promise.all([
        generateCode(activeKey, counter - 1),
        generateCode(activeKey, counter),
        generateCode(activeKey, counter + 1),
      ]);
      if (currentRequest !== requestId || !activeKey) return;
      activeCounter = counter;
      rawCodes = { previous: generated[0], current: generated[1], next: generated[2] };
      for (const [position, code] of Object.entries(rawCodes)) {
        codeElements[position].textContent = `${code.slice(0, 3)} ${code.slice(3)}`;
      }
      status.textContent = '三组验证码已生成';
      for (const button of copyButtons) button.disabled = false;
      result.classList.remove('is-empty');
      clearError();
    } catch (_) {
      resetResult();
      showError('验证码生成失败，请使用较新的浏览器后重试。');
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();
    if (!window.crypto?.subtle) {
      showError('当前浏览器不支持安全计算，请使用 HTTPS 打开页面。');
      return;
    }
    try {
      const currentRequest = ++requestId;
      const bytes = decodeBase32(normalizeSecret(secretInput.value));
      if (bytes.length === 0) throw new Error('密钥内容为空。');
      const importedKey = await crypto.subtle.importKey(
        'raw', bytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
      );
      if (currentRequest !== requestId) return;
      activeKey = importedKey;
      activeCounter = -1;
      status.textContent = '正在生成';
      await refresh();
    } catch (caught) {
      resetResult();
      showError(caught instanceof Error ? caught.message : '密钥格式不正确，请检查后重试。');
    }
  });

  secretInput.addEventListener('input', () => {
    if (activeKey || rawCodes.current) resetResult();
    else clearError();
  });

  visibilityButton.addEventListener('click', () => {
    const hidden = secretInput.type === 'password';
    secretInput.type = hidden ? 'text' : 'password';
    visibilityButton.textContent = hidden ? '隐藏' : '显示';
    visibilityButton.setAttribute('aria-label', `${hidden ? '隐藏' : '显示'}密钥`);
  });

  document.getElementById('clear').addEventListener('click', () => {
    secretInput.value = '';
    secretInput.type = 'password';
    visibilityButton.textContent = '显示';
    visibilityButton.setAttribute('aria-label', '显示密钥');
    resetResult();
    secretInput.focus();
  });

  for (const button of copyButtons) {
    button.addEventListener('click', async () => {
      const code = rawCodes[button.dataset.copy];
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code);
      } catch (_) {
        const input = document.createElement('input');
        input.value = code;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.append(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      button.textContent = '已复制';
      window.setTimeout(() => { if (rawCodes[button.dataset.copy]) button.textContent = '复制'; }, 1600);
    });
  }

  const direct = window.apkbangDirectSecret || '';
  window.apkbangDirectSecret = '';
  if (direct) {
    try {
      const decoded = decodeURIComponent(direct);
      if (decoded.length > 512) throw new Error('直达链接中的密钥过长。');
      secretInput.value = decoded;
      form.requestSubmit();
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : '直达链接中的密钥格式不正确。');
    }
  }

  window.setInterval(() => void refresh(), 500);
})();
