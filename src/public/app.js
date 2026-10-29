(function () {
  'use strict';

  const { useState, useEffect, useMemo, useCallback, useRef } = React;
  const html = htm.bind(React.createElement);
  const api = window.apiClient;

  const STATUS_LABELS = {
    MOI: 'Mới tiếp nhận',
    DA_PHAN_CONG: 'Đã phân công',
    DANG_XU_LY: 'Đang xử lý',
    CHO_LINH_KIEN: 'Chờ linh kiện',
    HOAN_TAT: 'Hoàn tất',
    DA_DONG: 'Đã đóng'
  };

  const STATUS_ORDER = ['MOI', 'DA_PHAN_CONG', 'DANG_XU_LY', 'CHO_LINH_KIEN', 'HOAN_TAT', 'DA_DONG'];

  const PRIORITY_LABELS = {
    CAO: 'Cao',
    TRUNG_BINH: 'Trung bình',
    THAP: 'Thấp'
  };

  const CATEGORY_LABELS = {
    MAN_HINH: 'Màn hình',
    PIN: 'Pin',
    SAC: 'Sạc',
    PHAN_MEM: 'Phần mềm',
    NUOC_VAO: 'Nước vào',
    KHAC: 'Khác'
  };

  const ACCESSORY_OPTIONS = [
    { value: 'SAC', label: 'Sạc' },
    { value: 'TAI_NGHE', label: 'Tai nghe' },
    { value: 'HOP', label: 'Hộp' },
    { value: 'KHAC', label: 'Khác' }
  ];

  const ROLE_LABELS = {
    NHAN_VIEN: 'Nhân viên tiếp nhận'
  };

  const OPEN_STATUSES = ['MOI', 'DA_PHAN_CONG', 'DANG_XU_LY', 'CHO_LINH_KIEN', 'HOAN_TAT'];

  function maskPhone(value) {
    const phone = String(value || '').replace(/\D/g, '');
    return phone.length === 10 ? `${phone.slice(0, 4)}***${phone.slice(-3)}` : '***';
  }

  /**
   * Định dạng ngày giờ theo tiếng Việt.
   *
   * @param {string|null} value Chuỗi ISO.
   * @returns {string} Chuỗi hiển thị hoặc dấu gạch.
   */
  function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  /**
   * Định dạng ngày theo tiếng Việt.
   *
   * @param {string|null} value Chuỗi ISO.
   * @returns {string} Chuỗi hiển thị hoặc dấu gạch.
   */
  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  /**
   * Đổi số giờ thành chuỗi dễ đọc.
   *
   * @param {number} hours Số giờ.
   * @returns {string} Chuỗi thời lượng.
   */
  function formatDuration(hours) {
    const absolute = Math.abs(hours);
    if (absolute < 1) return `${Math.max(1, Math.round(absolute * 60))} phút`;
    // Làm tròn tổng số giờ trước khi tách ngày/giờ để tránh trường hợp
    // phần dư 23,6 giờ bị làm tròn thành "24 giờ" (hiển thị "2 ngày 24 giờ").
    const totalHours = Math.round(absolute);
    if (totalHours < 24) return `${totalHours} giờ`;
    const days = Math.floor(totalHours / 24);
    const rest = totalHours % 24;
    return rest > 0 ? `${days} ngày ${rest} giờ` : `${days} ngày`;
  }

  /**
   * Tính ngữ cảnh SLA của một phiếu so với hạn cam kết (QT-04).
   *
   * @param {object} ticket View 14 khóa.
   * @returns {{tone: string, label: string, detail: string}} Ngữ cảnh.
   */
  function ticketSla(ticket) {
    if (!ticket || !ticket.hanCamKet) {
      return { tone: 'gray', label: 'Chưa có hạn', detail: 'Chưa xác định' };
    }
    if (ticket.trangThai === 'DA_DONG') {
      return { tone: 'gray', label: 'Đã đóng', detail: 'Kết thúc vòng đời' };
    }
    if (ticket.trangThai === 'HOAN_TAT') {
      return { tone: 'blue', label: 'Đã hoàn tất', detail: 'Chờ đóng phiếu' };
    }
    const diff = (new Date(ticket.hanCamKet).getTime() - Date.now()) / 3600000;
    if (diff < 0) {
      return { tone: 'red', label: 'Quá hạn', detail: `Quá ${formatDuration(diff)}` };
    }
    if (diff <= 4) {
      return { tone: 'amber', label: 'Sắp quá hạn', detail: `Còn ${formatDuration(diff)}` };
    }
    return { tone: 'green', label: 'Trong hạn', detail: `Còn ${formatDuration(diff)}` };
  }

  /**
   * Lấy tone màu cho trạng thái phiếu.
   *
   * @param {string} status Trạng thái QT-06.
   * @returns {string} Tên lớp pill.
   */
  function statusTone(status) {
    return {
      MOI: 'blue',
      DA_PHAN_CONG: 'violet',
      DANG_XU_LY: 'amber',
      CHO_LINH_KIEN: 'amber',
      HOAN_TAT: 'green',
      DA_DONG: 'gray'
    }[status] || 'gray';
  }

  /**
   * Lấy tone màu cho mức ưu tiên.
   *
   * @param {string} priority Mức ưu tiên.
   * @returns {string} Tên lớp pill.
   */
  function priorityTone(priority) {
    return { CAO: 'red', TRUNG_BINH: 'amber', THAP: 'gray' }[priority] || 'gray';
  }

  /**
   * Chuyển lỗi API thành cấu trúc 3 phần cho DataState.
   *
   * @param {Error & {status?: number, fields?: object, requestId?: string}} error Lỗi.
   * @param {string} what Chuyện gì.
   * @returns {{what: string, why: string, next: string, code: string|null, message: string}} Lỗi giao diện.
   */
  function toUiError(error, what) {
    const status = error && error.status ? error.status : 0;
    let why = 'Mất kết nối tới máy chủ hệ thống.';
    if (status >= 500) why = 'Máy chủ hệ thống gặp lỗi khi xử lý yêu cầu.';
    else if (error && error.code === 'HET_THOI_GIAN_CHO') why = error.message;
    else if (status === 403) why = 'Tài khoản không đủ quyền xem dữ liệu này.';
    else if (status === 404) why = 'Dữ liệu không còn tồn tại hoặc đã bị xoá.';
    else if (status) why = error.message || 'Yêu cầu không thực hiện được.';

    return {
      what,
      why,
      next: status === 0 ? 'Kiểm tra kết nối rồi bấm Thử lại.' : 'Bấm Thử lại. Nếu vẫn lỗi, báo quản trị viên kèm mã yêu cầu nếu có.',
      code: (error && error.requestId) || null,
      message: error && error.message ? error.message : ''
    };
  }

  function mutationErrorText(error) {
    const message = error.message || 'Chưa thể xác nhận kết quả lưu.';
    const uncertain = !error.status || error.status >= 500 || error.code === 'PHAN_HOI_KHONG_HOP_LE';
    return uncertain
      ? `${message} Kết quả lưu chưa xác định; hãy tra cứu lại trước khi tạo lại để tránh trùng dữ liệu.`
      : message;
  }

  function RequestId({ value }) {
    return value ? html`<div className="retrieval-code">Mã yêu cầu (requestId): <strong>${value}</strong></div>` : null;
  }

  /**
   * Lấy nhãn tiếng Việt của nhóm sự cố.
   *
   * @param {string} name Tên nhóm.
   * @returns {string} Nhãn.
   */
  function categoryLabel(name) {
    return CATEGORY_LABELS[name] || name || '—';
  }

  /**
   * Lấy nhãn tiếng Việt của phụ kiện.
   *
   * @param {string} value Mã phụ kiện.
   * @returns {string} Nhãn.
   */
  function accessoryLabel(value) {
    const option = ACCESSORY_OPTIONS.find((item) => item.value === value);
    return option ? option.label : value || '—';
  }

  /**
   * Lấy tên trung tâm từ danh mục.
   *
   * @param {string} centerId Mã trung tâm.
   * @param {{centers?: Array<object>}|null} catalogs Danh mục.
   * @returns {string} Tên trung tâm.
   */
  function centerName(centerId, catalogs) {
    const center = catalogs && catalogs.centers ? catalogs.centers.find((item) => item.center_id === centerId) : null;
    return center ? center.center_name : `Trung tâm ${centerId || '—'}`;
  }

  /**
   * Lấy chữ viết tắt từ họ tên.
   *
   * @param {string} name Họ tên.
   * @returns {string} Chữ viết tắt.
   */
  function initials(name) {
    return String(name || 'ND')
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  function Pill({ tone, children }) {
    return html`<span className=${`pill ${tone || 'gray'}`}>${children}</span>`;
  }

  function StatusPill({ status }) {
    return html`<${Pill} tone=${statusTone(status)}>${STATUS_LABELS[status] || status}<//>`;
  }

  function PriorityPill({ priority }) {
    return html`<${Pill} tone=${priorityTone(priority)}>${PRIORITY_LABELS[priority] || priority}<//>`;
  }

  function WarrantyPill({ value }) {
    if (value === true) return html`<${Pill} tone="green">Còn bảo hành<//>`;
    if (value === false) return html`<${Pill} tone="red">Hết bảo hành<//>`;
    return html`<${Pill} tone="amber">Chưa xác minh<//>`;
  }

  function SlaPill({ ticket }) {
    const context = ticketSla(ticket);
    return html`
      <div>
        <${Pill} tone=${context.tone}>${context.label}<//>
        <div className="cell-sub">${context.detail}</div>
      </div>
    `;
  }

  function LoadingState({ text }) {
    return html`
      <div>
        <div className="skeleton" aria-hidden="true">
          ${[0, 1, 2, 3, 4].map((index) => html`<div key=${index} className="skeleton-row"></div>`)}
        </div>
        <div className="loading-line" style=${{ marginTop: '14px' }}>
          <span className="spinner"></span>
          <span>${text}</span>
        </div>
      </div>
    `;
  }

  function DataState({
    loading,
    error,
    isEmpty,
    isFiltered,
    loadingText,
    onRetry,
    onClearFilters,
    onCreate,
    emptyTitle,
    emptyText,
    emptyActionLabel,
    onEmptyAction,
    children
  }) {
    if (loading) {
      return html`<div className="data-state"><${LoadingState} text=${loadingText} /></div>`;
    }

    if (error) {
      return html`
        <div className="data-state">
          <div className="error-state">
            <div className="state-icon error">!</div>
            <div style=${{ minWidth: 0 }}>
              <h3 className="state-title">Chưa tải được dữ liệu</h3>
              <p className="state-text">Hệ thống chưa thể hoàn tất yêu cầu. Thông tin dưới đây giúp bạn báo lỗi nhanh.</p>
              <div className="error-sections">
                <div className="error-section">
                  <b>Chuyện gì</b>
                  <span>${error.what}</span>
                </div>
                <div className="error-section">
                  <b>Vì sao</b>
                  <span>${error.why}</span>
                </div>
                <div className="error-section">
                  <b>Làm gì tiếp</b>
                  <span>${error.next}</span>
                </div>
              </div>
              <div className="retrieval-code">${error.code
                ? html`Mã yêu cầu (requestId): <strong>${error.code}</strong>`
                : 'Chưa có mã yêu cầu từ máy chủ.'}</div>
              <div className="state-actions">
                <button className="btn primary" type="button" onClick=${onRetry}>Thử lại</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (isEmpty) {
      if (emptyTitle) {
        return html`
          <div className="data-state">
            <div className="empty-state">
              <div className="state-icon">⌕</div>
              <div>
                <h3 className="state-title">${emptyTitle}</h3>
                <p className="state-text">${emptyText}</p>
                <div className="state-actions">
                  <button className="btn primary" type="button" onClick=${onEmptyAction}>${emptyActionLabel}</button>
                </div>
              </div>
            </div>
          </div>
        `;
      }
      if (isFiltered) {
        return html`
          <div className="data-state">
            <div className="empty-state">
              <div className="state-icon">⌕</div>
              <div>
                <h3 className="state-title">Chưa có kết quả phù hợp</h3>
                <p className="state-text">Không có phiếu nào khớp bộ lọc hiện tại.</p>
                <p className="state-text">Hãy xoá bộ lọc để xem toàn bộ danh sách phiếu của trung tâm.</p>
                <div className="state-actions">
                  <button className="btn primary" type="button" onClick=${onClearFilters}>Xoá bộ lọc</button>
                </div>
              </div>
            </div>
          </div>
        `;
      }
      return html`
        <div className="data-state">
          <div className="empty-state">
            <div className="state-icon">＋</div>
            <div>
              <h3 className="state-title">Chưa có dữ liệu</h3>
              <p className="state-text">Chưa có phiếu bảo hành nào. Bấm Tiếp nhận phiếu mới để tạo phiếu đầu tiên.</p>
              <div className="state-actions">
                <button className="btn primary" type="button" onClick=${onCreate}>Tiếp nhận phiếu mới</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    return children;
  }

  function MetricCard({ value, label, note, tone }) {
    return html`
      <div className=${`metric-card ${tone || ''}`}>
        <div className="metric-value">${value}</div>
        <div className="metric-label">${label}</div>
        <div className="metric-note">${note}</div>
      </div>
    `;
  }

  function LoginScreen({ onLogin }) {
    const [username, setUsername] = useState('nhanvien');
    const [password, setPassword] = useState('nhanvien123');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function submit(event) {
      event.preventDefault();
      setLoading(true);
      setError('');
      try {
        const session = await api.login(username.trim(), password);
        onLogin(session);
      } catch (err) {
        setError(`${err.message || 'Đăng nhập không thành công.'}${err.requestId ? ` · requestId: ${err.requestId}` : ''}`);
      } finally {
        setLoading(false);
      }
    }

    function useDemo(user, pass) {
      setUsername(user);
      setPassword(pass);
      setError('');
    }

    return html`
      <div className="login-shell">
        <div className="login-card">
          <section className="login-hero">
            <div>
              <div className="brand">
                <div className="brand-mark">MM</div>
                <div>
                  <h2 className="brand-title" style=${{ color: '#fff' }}>Mekong Mobile</h2>
                  <p className="brand-subtitle" style=${{ color: '#cfe0ff' }}>Smart CRM · Luồng L2</p>
                </div>
              </div>
              <h1>Tiếp nhận bảo hành,<br />rõ ràng từ phút đầu.</h1>
              <p>
                Tra cứu khách hàng, ghi nhận thiết bị, kiểm tra hạn bảo hành và sinh hạn cam kết
                trả máy theo đúng quy tắc nghiệp vụ.
              </p>
              <div className="login-points">
                <div className="login-point"><i>01</i><span>Tra cứu khách hàng bằng số điện thoại chuẩn hóa (QT-01, QT-02).</span></div>
                <div className="login-point"><i>02</i><span>Kiểm tra bảo hành theo ngày mua; thiếu ngày mua là “chưa xác minh” (QT-05).</span></div>
                <div className="login-point"><i>03</i><span>Hạn cam kết 24/72/120 giờ làm việc, bỏ Chủ Nhật (QT-04).</span></div>
              </div>
            </div>
            <p style=${{ fontSize: '11.5px', color: '#b9cdf5' }}>
              Prototype học phần Chuyên đề tốt nghiệp 1 · Track SE · Nguyễn Duy Khang
            </p>
          </section>

          <form className="login-form" onSubmit=${submit}>
            <h2>Đăng nhập hệ thống</h2>
            <p>Dùng tài khoản demo để kiểm chứng giao diện 3 màn hình và 3 trạng thái.</p>

            ${error ? html`<div className="inline-alert error">${error}</div>` : null}

            <label className="field">
              <span>Tên đăng nhập</span>
              <input
                className="input"
                value=${username}
                onChange=${(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder="nhanvien"
              />
            </label>
            <label className="field">
              <span>Mật khẩu</span>
              <input
                className="input"
                type="password"
                value=${password}
                onChange=${(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </label>

            <button className="btn primary" type="submit" disabled=${loading}>
              ${loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>

            <div className="demo-accounts">
              <button
                className="demo-account"
                type="button"
                onClick=${() => useDemo('nhanvien', 'nhanvien123')}
              >
                <b>Nhân viên tiếp nhận</b>
                <span>nhanvien / nhanvien123</span>
              </button>
            </div>

            <p className="hint">
              JWT được lưu trong localStorage để đơn giản hóa prototype. Cách lưu này có rủi ro XSS;
              sản phẩm thật nên dùng cookie HttpOnly, SameSite và CSP.
            </p>
          </form>
        </div>
      </div>
    `;
  }

  function TicketList({ catalogs, onOpen, onNew, refreshKey, onReloadCatalogs }) {
    const [allTickets, setAllTickets] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState(null);
    const [demoState, setDemoState] = useState(null);
    const [filters, setFilters] = useState({
      status: '',
      nhomSuCo: '',
      priority: '',
      q: ''
    });
    const listRequest = useRef(0);

    const loadAll = useCallback(async () => {
      const request = ++listRequest.current;
      setLoading(true);
      setError(null);
      try {
        const payload = await api.listTickets();
        if (request !== listRequest.current) return;
        const rows = Array.isArray(payload.data) ? payload.data : [];
        setAllTickets(rows);
        setTickets(rows);
      } catch (err) {
        if (request === listRequest.current) setError(toUiError(err, 'Chưa tải được danh sách phiếu.'));
      } finally {
        if (request === listRequest.current) setLoading(false);
      }
    }, []);

    useEffect(() => {
      loadAll();
      return () => { listRequest.current += 1; };
    }, [loadAll, refreshKey]);

    useEffect(() => {
      const q = filters.q.trim();
      if (!q) {
        setTickets(allTickets);
        setSearching(false);
        return undefined;
      }

      let cancelled = false;
      setSearching(true);
      const timer = setTimeout(async () => {
        try {
          const payload = await api.listTickets({ q });
          if (!cancelled) {
            setTickets(Array.isArray(payload.data) ? payload.data : []);
            setError(null);
          }
        } catch (err) {
          if (!cancelled) setError(toUiError(err, 'Chưa tìm được phiếu theo từ khóa.'));
        } finally {
          if (!cancelled) setSearching(false);
        }
      }, 350);

      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [filters.q, allTickets]);

    const categoryOptions = useMemo(() => {
      if (catalogs && Array.isArray(catalogs.categories) && catalogs.categories.length > 0) {
        return catalogs.categories.map((category) => ({
          value: category.category_name,
          label: categoryLabel(category.category_name)
        }));
      }
      const names = [...new Set(allTickets.map((ticket) => ticket.nhomSuCo).filter(Boolean))];
      return names.map((name) => ({ value: name, label: categoryLabel(name) }));
    }, [catalogs, allTickets]);

    const filtered = useMemo(() => {
      return tickets.filter((ticket) => {
        if (filters.status && ticket.trangThai !== filters.status) return false;
        if (filters.nhomSuCo && ticket.nhomSuCo !== filters.nhomSuCo) return false;
        if (filters.priority && ticket.mucUuTien !== filters.priority) return false;
        return true;
      });
    }, [tickets, filters]);

    const stats = useMemo(() => {
      const open = allTickets.filter((ticket) => OPEN_STATUSES.includes(ticket.trangThai));
      const overdue = open.filter((ticket) => ticketSla(ticket).tone === 'red');
      const soon = open.filter((ticket) => ticketSla(ticket).tone === 'amber');
      const closed = allTickets.filter((ticket) => ticket.trangThai === 'DA_DONG');
      const inSla = open.length - overdue.length;
      return {
        total: allTickets.length,
        open: open.length,
        overdue: overdue.length,
        soon: soon.length,
        closed: closed.length,
        inSlaRate: open.length === 0 ? null : Math.round((inSla / open.length) * 100)
      };
    }, [allTickets]);

    const hasFilters = Boolean(filters.status || filters.nhomSuCo || filters.priority || filters.q.trim());

    function resetFilters() {
      setFilters({ status: '', nhomSuCo: '', priority: '', q: '' });
      setDemoState(null);
    }

    function showDemoLoading() {
      setDemoState('loading');
      window.setTimeout(() => setDemoState((current) => (current === 'loading' ? null : current)), 1600);
    }

    const demoError = {
      what: 'Chưa tải được danh sách phiếu.',
      why: 'Mất kết nối tới máy chủ hệ thống.',
      next: 'Kiểm tra kết nối rồi bấm Thử lại.',
      code: null,
      message: ''
    };

    const effectiveError = demoState === 'error' ? demoError : error;
    const showNoData = demoState === 'empty-no-data' || (!loading && allTickets.length === 0);
    const showFilterEmpty =
      demoState === 'empty-filter' ||
      (!loading && filtered.length === 0 && allTickets.length > 0 && hasFilters);
    const effectiveEmpty = showNoData || showFilterEmpty;
    const effectiveFiltered = demoState === 'empty-filter' ? true : showFilterEmpty ? true : false;
    const metricsUnavailable = loading || Boolean(effectiveError);
    const metricValue = (value) => metricsUnavailable ? '—' : value;

    return html`
      <section className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Danh sách phiếu bảo hành</h1>
            <p className="page-subtitle">
              Theo dõi toàn bộ phiếu của trung tâm, so sánh với mục tiêu SLA 24/72/120 giờ làm việc
              và ưu tiên xử lý các phiếu sắp quá hạn.
            </p>
          </div>
          <button className="btn primary" type="button" onClick=${onNew}>+ Tiếp nhận phiếu mới</button>
        </div>

        <div className="sla-banner">
          <div>
            <strong>Ngữ cảnh so sánh SLA:</strong> ${metricsUnavailable
              ? 'Chưa có số liệu để tính tỷ lệ.'
              : stats.inSlaRate === null ? 'Không có phiếu mở để tính tỷ lệ.'
              : `${stats.inSlaRate}% phiếu đang mở còn trong hạn.`}
            Mục tiêu là 100% phiếu mở không vượt hạn cam kết.
          </div>
          <div className="sla-targets">
            <span className="sla-chip">CAO · 24 giờ</span>
            <span className="sla-chip">TRUNG_BÌNH · 72 giờ</span>
            <span className="sla-chip">THẤP · 120 giờ</span>
            <span className="sla-chip">T2–T7 · bỏ Chủ Nhật</span>
          </div>
        </div>

        <div className="metrics-grid">
          <${MetricCard} value=${metricValue(stats.total)} label="Tổng phiếu" note="Toàn bộ phiếu của trung tâm" />
          <${MetricCard} value=${metricValue(stats.open)} label="Đang mở" note="Chưa ở trạng thái Đã đóng" />
          <${MetricCard}
            value=${metricValue(stats.overdue)}
            label="Quá hạn"
            note="Cần xử lý ngay"
            tone=${stats.overdue > 0 ? 'alert' : ''}
          />
          <${MetricCard}
            value=${metricValue(stats.soon)}
            label="Sắp quá hạn"
            note="Còn tối đa 4 giờ"
            tone=${stats.soon > 0 ? 'warn' : ''}
          />
          <${MetricCard} value=${metricValue(stats.closed)} label="Đã đóng" note="Đã kết thúc vòng đời" />
        </div>

        <details>
          <summary>Công cụ kiểm chứng (mô phỏng, không phải lỗi kết nối thật)</summary>
          <div className="demo-toolbar">
          <span className="label">Kiểm chứng trạng thái giao diện:</span>
          <button className="btn small" type="button" onClick=${showDemoLoading}>Đang tải</button>
          <button className="btn small" type="button" onClick=${() => setDemoState('empty-no-data')}>
            Rỗng · chưa có dữ liệu
          </button>
          <button className="btn small" type="button" onClick=${() => setDemoState('empty-filter')}>
            Rỗng · bộ lọc
          </button>
          <button className="btn small" type="button" onClick=${() => setDemoState('error')}>
            Lỗi
          </button>
          <button className="btn small ghost" type="button" onClick=${() => setDemoState(null)}>
            Về dữ liệu thật
          </button>
          </div>
        </details>

        <div className="filters">
          <label className="field">
            <span>Tìm kiếm</span>
            <input
              className="input"
              value=${filters.q}
              placeholder="Mã phiếu hoặc SĐT khách hàng"
              onChange=${(event) => setFilters({ ...filters, q: event.target.value })}
            />
          </label>

          <label className="field">
            <span>Trạng thái</span>
            <select
              className="select"
              value=${filters.status}
              onChange=${(event) => setFilters({ ...filters, status: event.target.value })}
            >
              <option value="">Tất cả trạng thái</option>
              ${STATUS_ORDER.map(
                (status) => html`<option key=${status} value=${status}>${STATUS_LABELS[status]}</option>`
              )}
            </select>
          </label>

          <label className="field">
            <span>Nhóm sự cố</span>
            <select
              className="select"
              value=${filters.nhomSuCo}
              onChange=${(event) => setFilters({ ...filters, nhomSuCo: event.target.value })}
            >
              <option value="">Tất cả nhóm</option>
              ${categoryOptions.map(
                (category) => html`<option key=${category.value} value=${category.value}>${category.label}</option>`
              )}
            </select>
          </label>

          <label className="field">
            <span>Mức ưu tiên</span>
            <select
              className="select"
              value=${filters.priority}
              onChange=${(event) => setFilters({ ...filters, priority: event.target.value })}
            >
              <option value="">Tất cả mức</option>
              ${['CAO', 'TRUNG_BINH', 'THAP'].map(
                (priority) => html`<option key=${priority} value=${priority}>${PRIORITY_LABELS[priority]}</option>`
              )}
            </select>
          </label>

          <button className="btn" type="button" onClick=${resetFilters} disabled=${!hasFilters}>
            Xoá lọc
          </button>
        </div>

        ${searching
          ? html`<div className="loading-line"><span className="spinner"></span><span>Đang tìm phiếu theo từ khóa...</span></div>`
          : null}

        <${DataState}
          loading=${loading || demoState === 'loading'}
          error=${effectiveError}
          isEmpty=${effectiveEmpty}
          isFiltered=${effectiveFiltered}
          loadingText="Đang tải danh sách phiếu bảo hành..."
          onRetry=${() => {
            setDemoState(null);
            loadAll();
          }}
          onClearFilters=${resetFilters}
          onCreate=${onNew}
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Khách hàng</th>
                  <th>Thiết bị</th>
                  <th>Nhóm sự cố</th>
                  <th>Ưu tiên</th>
                  <th>Trạng thái</th>
                  <th>Hạn cam kết</th>
                  <th>Ngữ cảnh SLA</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map((ticket) => {
                  const sla = ticketSla(ticket);
                  const rowClass =
                    sla.tone === 'red' ? 'row-overdue' : sla.tone === 'amber' ? 'row-soon' : '';
                  return html`
                    <tr
                      key=${ticket.ticketId}
                      className=${`clickable ${rowClass}`}
                      onClick=${() => onOpen(ticket.ticketId)}
                    >
                      <td>
                        <div className="cell-strong">${ticket.ticketCode}</div>
                        <div className="cell-sub">${ticket.ticketId}</div>
                      </td>
                      <td>
                        <div className="cell-strong">${ticket.tenKhach}</div>
                        <div className="cell-sub">${ticket.sdtHienThi}</div>
                      </td>
                      <td>
                        <div className="cell-strong">${ticket.tenThietBi}</div>
                        <div className="cell-sub">${ticket.serialNo}</div>
                      </td>
                      <td>${categoryLabel(ticket.nhomSuCo)}</td>
                      <td><${PriorityPill} priority=${ticket.mucUuTien} /></td>
                      <td><${StatusPill} status=${ticket.trangThai} /></td>
                      <td>
                        <div className="cell-strong">${formatDateTime(ticket.hanCamKet)}</div>
                        <div className="cell-sub">Tiếp nhận ${formatDateTime(ticket.ngayTiepNhan)}</div>
                      </td>
                      <td><${SlaPill} ticket=${ticket} /></td>
                    </tr>
                  `;
                })}
              </tbody>
            </table>
          </div>
          <div className="cell-sub" style=${{ marginTop: '9px' }}>
            Hiển thị ${filtered.length} / ${allTickets.length} phiếu. Sắp xếp theo hạn cam kết tăng dần.
          </div>
        <//>
      </section>
    `;
  }

  function IntakeScreen({ session, catalogs, catalogsLoading, catalogsError, onReloadCatalogs, onCreated, onCancel }) {
    const [receivedAt] = useState(() => new Date().toISOString());
    const [phone, setPhone] = useState('');
    const [customer, setCustomer] = useState(null);
    const [customerLoading, setCustomerLoading] = useState(false);
    const [customerMessage, setCustomerMessage] = useState(null);
    const [showCustomerForm, setShowCustomerForm] = useState(false);
    const [customerForm, setCustomerForm] = useState({
      full_name: '',
      phone: '',
      email: '',
      address: ''
    });

    const [serial, setSerial] = useState('');
    const [deviceResult, setDeviceResult] = useState(null);
    const [deviceLoading, setDeviceLoading] = useState(false);
    const [deviceMessage, setDeviceMessage] = useState(null);
    const [showDeviceForm, setShowDeviceForm] = useState(false);
    const [deviceForm, setDeviceForm] = useState({
      product_name: '',
      serial_no: '',
      purchase_date: '',
      warranty_months: 12
    });

    const [ticketForm, setTicketForm] = useState({
      category_id: '',
      issue_desc: '',
      accessories: [],
      exterior_note: '',
      priority: '',
      priority_reason: ''
    });
    const [preview, setPreview] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const customerRequest = useRef(0);
    const deviceRequest = useRef(0);
    const customerVersion = customerRequest.current;
    const deviceVersion = deviceRequest.current;
    const pending = useRef({ customer: false, device: false, saving: false });
    const mounted = useRef(true);
    const [centerId, setCenterId] = useState(
      (session.user && session.user.center_id) ||
        (catalogs && catalogs.centers && catalogs.centers[0] ? catalogs.centers[0].center_id : '')
    );

    const selectedCategory =
      catalogs && Array.isArray(catalogs.categories)
        ? catalogs.categories.find((category) => category.category_id === ticketForm.category_id)
        : null;

    const priorityChanged =
      Boolean(selectedCategory) &&
      Boolean(ticketForm.priority) &&
      ticketForm.priority !== selectedCategory.default_priority;

    useEffect(() => {
      mounted.current = true;
      return () => {
        mounted.current = false;
        customerRequest.current += 1;
        deviceRequest.current += 1;
      };
    }, []);

    useEffect(() => {
      if (!ticketForm.priority) {
        setPreview(null);
        setPreviewLoading(false);
        return undefined;
      }
      let cancelled = false;
      setPreview(null);
      setPreviewLoading(true);
      const timer = setTimeout(async () => {
        try {
          const result = await api.previewDueDate(ticketForm.priority, receivedAt);
          if (!cancelled) setPreview(result);
        } catch (err) {
          if (!cancelled) setPreview(null);
        } finally {
          if (!cancelled) setPreviewLoading(false);
        }
      }, 220);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [ticketForm.priority, receivedAt]);

    const catalogsEmpty =
      !catalogs ||
      !Array.isArray(catalogs.centers) || catalogs.centers.length === 0 ||
      !Array.isArray(catalogs.categories) || catalogs.categories.length === 0;

    if (!session.user || session.user.role !== 'NHAN_VIEN') {
      return html`<section className="page"><div className="inline-alert error">Chỉ nhân viên tiếp nhận được tạo phiếu.</div><button className="btn" type="button" onClick=${onCancel}>Về danh sách phiếu</button></section>`;
    }

    if (catalogsLoading || catalogsError || catalogsEmpty) {
      return html`
        <section className="page">
          <button className="back-link" type="button" onClick=${onCancel}>← Danh sách phiếu</button>
          <h1 className="page-title">Tiếp nhận phiếu bảo hành mới</h1>
          <${DataState}
            loading=${catalogsLoading}
            loadingText="Đang tải danh mục trung tâm và nhóm sự cố..."
            error=${catalogsError ? toUiError(catalogsError, 'Chưa tải được danh mục hệ thống.') : null}
            isEmpty=${catalogsEmpty}
            onRetry=${onReloadCatalogs}
            emptyTitle="Chưa có danh mục tiếp nhận"
            emptyText="Cần có trung tâm và nhóm sự cố để tạo phiếu. Hãy nạp danh mục bằng npm run db:seed rồi tải lại."
            emptyActionLabel="Tải lại danh mục"
            onEmptyAction=${onReloadCatalogs}
          />
        </section>
      `;
    }

    function resetDeviceSelection(clearSerial) {
      deviceRequest.current += 1;
      pending.current.device = false;
      setDeviceResult(null);
      setDeviceLoading(false);
      setDeviceMessage(null);
      setShowDeviceForm(false);
      if (clearSerial) setSerial('');
      setSaveError(null);
    }

    function resetCustomerSelection() {
      customerRequest.current += 1;
      pending.current.customer = false;
      setCustomer(null);
      setCustomerLoading(false);
      setCustomerMessage(null);
      resetDeviceSelection(true);
    }

    function changePhone(value) {
      if (pending.current.saving) return;
      setPhone(value);
      resetCustomerSelection();
      setShowCustomerForm(false);
    }

    function changeCustomerForm(name, value) {
      if (pending.current.saving) return;
      resetCustomerSelection();
      setCustomerForm((current) => ({ ...current, [name]: value }));
      if (name === 'phone') setPhone(value);
    }

    function changeSerial(value) {
      if (pending.current.saving) return;
      setSerial(value);
      resetDeviceSelection(false);
    }

    function changeDeviceForm(name, value) {
      if (pending.current.saving) return;
      deviceRequest.current += 1;
      pending.current.device = false;
      setDeviceResult(null);
      setDeviceLoading(false);
      setDeviceMessage(null);
      setSaveError(null);
      setDeviceForm((current) => ({ ...current, [name]: value }));
      if (name === 'serial_no') setSerial(value);
    }

    async function lookupCustomerByPhone() {
      if (pending.current.customer || pending.current.saving) return;
      resetCustomerSelection();
      setShowCustomerForm(false);
      const request = customerRequest.current;
      if (!phone.trim()) {
        setCustomerMessage({ type: 'error', text: 'Nhập số điện thoại khách hàng trước khi tra cứu.' });
        return;
      }
      setCustomerLoading(true);
      pending.current.customer = true;
      setCustomerMessage(null);
      try {
        const found = await api.lookupCustomer(phone);
        if (request !== customerRequest.current) return;
        setCustomer(found);
        setShowCustomerForm(false);
        setCustomerMessage({ type: 'ok', text: 'Đã tìm thấy hồ sơ khách hàng có sẵn.' });
      } catch (err) {
        if (request !== customerRequest.current) return;
        if (err.status === 404) {
          setCustomer(null);
          setShowCustomerForm(true);
          setCustomerForm({ full_name: '', phone, email: '', address: '' });
          setCustomerMessage({
            type: 'info',
            text: 'Chưa có hồ sơ với số điện thoại này. Điền họ tên để tạo khách hàng mới (QT-01).'
          });
        } else {
          setCustomerMessage({ type: 'error', text: err.message, fields: err.fields, requestId: err.requestId });
        }
      } finally {
        if (request === customerRequest.current) {
          pending.current.customer = false;
          setCustomerLoading(false);
        }
      }
    }

    async function createNewCustomer() {
      if (pending.current.customer || pending.current.saving) return;
      resetCustomerSelection();
      const request = customerRequest.current;
      pending.current.customer = true;
      setCustomerLoading(true);
      setCustomerMessage(null);
      try {
        const created = await api.createCustomer({
          full_name: customerForm.full_name,
          phone: customerForm.phone || phone,
          email: customerForm.email || null,
          address: customerForm.address || ''
        });
        if (request !== customerRequest.current) return;
        setCustomer(created);
        setPhone(created.phone);
        setShowCustomerForm(false);
        setCustomerMessage({ type: 'ok', text: 'Đã tạo hồ sơ khách hàng mới.' });
      } catch (err) {
        if (request !== customerRequest.current) return;
        setCustomerMessage({ type: 'error', text: mutationErrorText(err), fields: err.fields, requestId: err.requestId });
      } finally {
        if (request === customerRequest.current) {
          pending.current.customer = false;
          setCustomerLoading(false);
        }
      }
    }

    async function lookupDeviceBySerial() {
      if (pending.current.device || pending.current.saving) return;
      resetDeviceSelection(false);
      const request = deviceRequest.current;
      if (!customer) {
        setDeviceMessage({ type: 'error', text: 'Chọn hoặc tạo khách hàng trước khi tra cứu thiết bị.' });
        return;
      }
      if (!serial.trim()) {
        setDeviceMessage({ type: 'error', text: 'Nhập serial/IMEI của thiết bị.' });
        return;
      }
      setDeviceLoading(true);
      pending.current.device = true;
      setDeviceMessage(null);
      try {
        const result = await api.lookupDevice(serial, receivedAt);
        if (request !== deviceRequest.current) return;
        setDeviceResult(result);
        if (result.device && result.device.customer_id !== customer.customer_id) {
          setDeviceMessage({
            type: 'warning',
            text: 'Thiết bị này đang thuộc khách hàng khác (QT-03). Không thể tiếp nhận cho khách hàng hiện tại.'
          });
        } else {
          setShowDeviceForm(false);
          setDeviceMessage({ type: 'ok', text: 'Đã tìm thấy thiết bị và kiểm tra bảo hành tự động (QT-05).' });
        }
      } catch (err) {
        if (request !== deviceRequest.current) return;
        if (err.status === 404) {
          setDeviceResult(null);
          setShowDeviceForm(true);
          setDeviceForm({ product_name: '', serial_no: serial, purchase_date: '', warranty_months: 12 });
          setDeviceMessage({
            type: 'info',
            text: 'Chưa có thiết bị với serial này. Điền thông tin để tạo thiết bị mới (QT-03).'
          });
        } else {
          setDeviceMessage({ type: 'error', text: err.message, fields: err.fields, requestId: err.requestId });
        }
      } finally {
        if (request === deviceRequest.current) {
          pending.current.device = false;
          setDeviceLoading(false);
        }
      }
    }

    async function createNewDevice() {
      if (pending.current.device || pending.current.saving) return;
      if (!customer) {
        setDeviceMessage({ type: 'error', text: 'Chọn khách hàng trước khi tạo thiết bị.' });
        return;
      }
      setDeviceLoading(true);
      setDeviceResult(null);
      const request = ++deviceRequest.current;
      pending.current.device = true;
      setDeviceMessage(null);
      try {
        const result = await api.createDevice({
          customer_id: customer.customer_id,
          product_name: deviceForm.product_name,
          serial_no: deviceForm.serial_no || serial,
          purchase_date: deviceForm.purchase_date || null,
          warranty_months: Number(deviceForm.warranty_months)
        });
        if (request !== deviceRequest.current) return;
        setDeviceResult(result);
        setSerial(result.device.serial_no);
        setShowDeviceForm(false);
        setDeviceMessage({ type: 'ok', text: 'Đã tạo thiết bị mới và kiểm tra bảo hành (QT-05).' });
      } catch (err) {
        if (request !== deviceRequest.current) return;
        setDeviceMessage({ type: 'error', text: mutationErrorText(err), fields: err.fields, requestId: err.requestId });
      } finally {
        if (request === deviceRequest.current) {
          pending.current.device = false;
          setDeviceLoading(false);
        }
      }
    }

    function changeCategory(event) {
      const categoryId = event.target.value;
      const category =
        catalogs && Array.isArray(catalogs.categories)
          ? catalogs.categories.find((item) => item.category_id === categoryId)
          : null;
      setTicketForm((current) => ({
        ...current,
        category_id: categoryId,
        priority: category ? category.default_priority : '',
        priority_reason: ''
      }));
      setSaveError(null);
    }

    function toggleAccessory(value) {
      setTicketForm((current) => {
        const exists = current.accessories.includes(value);
        return {
          ...current,
          accessories: exists
            ? current.accessories.filter((item) => item !== value)
            : [...current.accessories, value]
        };
      });
    }

    async function saveTicket() {
      if (!mounted.current || pending.current.saving) return;
      const fields = {};
      if (customerVersion !== customerRequest.current || deviceVersion !== deviceRequest.current) {
        setSaveError({ message: 'Khách hàng hoặc thiết bị đã thay đổi. Hãy tra cứu lại trước khi lưu.', fields });
        return;
      }
      if (pending.current.customer || pending.current.device || customerLoading || deviceLoading) {
        setSaveError({ message: 'Chờ tra cứu hoặc tạo khách hàng/thiết bị hoàn tất trước khi lưu.', fields });
        return;
      }
      if (!session.user || session.user.role !== 'NHAN_VIEN') {
        setSaveError({ message: 'Chỉ nhân viên tiếp nhận được tạo phiếu.', fields });
        return;
      }
      if (!customer) fields.customer_id = 'Chọn khách hàng.';
      if (!deviceResult || !deviceResult.device) fields.device_id = 'Chọn thiết bị.';
      if (!ticketForm.category_id) fields.category_id = 'Chọn nhóm sự cố.';
      if (ticketForm.issue_desc.trim().length < 10) {
        fields.issue_desc = 'Mô tả lỗi phải có ít nhất 10 ký tự.';
      }
      if (priorityChanged && !ticketForm.priority_reason.trim()) {
        fields.priority_reason = 'Nhập lý do khi đổi mức ưu tiên khác gợi ý.';
      }
      if (deviceResult && deviceResult.device && customer && deviceResult.device.customer_id !== customer.customer_id) {
        fields.device_id = 'Thiết bị không thuộc khách hàng đã chọn (QT-03).';
      }
      if (Object.keys(fields).length > 0) {
        setSaveError({ message: 'Vui lòng kiểm tra các trường được đánh dấu.', fields });
        return;
      }

      setSaving(true);
      pending.current.saving = true;
      setSaveError(null);
      try {
        const detail = await api.createTicket({
          customer_id: customer.customer_id,
          device_id: deviceResult.device.device_id,
          center_id: centerId,
          category_id: ticketForm.category_id,
          issue_desc: ticketForm.issue_desc.trim(),
          accessories: ticketForm.accessories,
          exterior_note: ticketForm.exterior_note.trim(),
          priority: ticketForm.priority,
          priority_reason: priorityChanged ? ticketForm.priority_reason.trim() : '',
          received_at: receivedAt
        });
        if (mounted.current) onCreated(detail.ticket.ticketId);
      } catch (err) {
        if (mounted.current) setSaveError({ message: mutationErrorText(err), fields: err.fields, code: err.requestId });
      } finally {
        pending.current.saving = false;
        if (mounted.current) setSaving(false);
      }
    }

    const fieldError = (fields, name) => (fields && fields[name] ? fields[name] : '');
    const inputClass = (fields, name) => `input${fieldError(fields, name) ? ' invalid' : ''}`;
    const selectClass = (fields, name) => `select${fieldError(fields, name) ? ' invalid' : ''}`;
    const textareaClass = (fields, name) => `textarea${fieldError(fields, name) ? ' invalid' : ''}`;

    return html`
      <section className="page">
        <div className="page-header">
          <div>
            <button className="back-link" type="button" onClick=${onCancel}>← Danh sách phiếu</button>
            <h1 className="page-title" style=${{ marginTop: '6px' }}>Tiếp nhận phiếu bảo hành mới</h1>
            <p className="page-subtitle">
              Tra cứu khách hàng bằng SĐT, xác định thiết bị bằng serial, kiểm tra bảo hành và lưu
              phiếu ở trạng thái <strong>MOI</strong> theo đúng Luồng L2.
            </p>
          </div>
          <div className="inline-alert">
            Thời điểm tiếp nhận: <strong>${formatDateTime(receivedAt)}</strong><br />
            Hạn cam kết được tính tự động theo QT-04.
          </div>
        </div>

        <fieldset className="intake-grid" disabled=${saving} style=${{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div style=${{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <section className="panel">
              <header className="panel-header">
                <div className="step-badge">1</div>
                <h2 className="panel-title">Khách hàng · QT-01, QT-02</h2>
              </header>
              <div className="panel-body">
                <div className="lookup-row">
                  <label className="field">
                    <span>Số điện thoại</span>
                    <input
                      className=${inputClass(customerMessage && customerMessage.fields, 'phone')}
                      value=${phone}
                      placeholder="0901234567 hoặc +84 90 123 4567"
                      onChange=${(event) => changePhone(event.target.value)}
                      onKeyDown=${(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          lookupCustomerByPhone();
                        }
                      }}
                    />
                    ${fieldError(customerMessage && customerMessage.fields, 'phone')
                      ? html`<small className="field-error">${fieldError(customerMessage && customerMessage.fields, 'phone')}</small>`
                      : null}
                  </label>
                  <button className="btn primary" type="button" onClick=${lookupCustomerByPhone} disabled=${customerLoading}>
                    ${customerLoading ? 'Đang tra cứu...' : 'Tra cứu'}
                  </button>
                </div>

                ${customerMessage
                  ? html`<div className=${`inline-alert ${customerMessage.type === 'error' ? 'error' : ''}`}>${customerMessage.text}<${RequestId} value=${customerMessage.requestId} /></div>`
                  : null}

                ${customer
                  ? html`
                      <div className="lookup-result">
                        <div>
                          <strong>${customer.full_name}</strong>
                          <span>${maskPhone(customer.phone)} · ${customer.customer_id}</span>
                          <div className="cell-sub">${customer.address || 'Chưa có địa chỉ'}</div>
                        </div>
                        <${Pill} tone="green">Đã có hồ sơ<//>
                      </div>
                    `
                  : null}

                ${showCustomerForm
                  ? html`
                      <div className="form-grid">
                        <label className="field">
                          <span>Họ tên *</span>
                          <input
                            className=${inputClass(customerMessage && customerMessage.fields, 'full_name')}
                            value=${customerForm.full_name}
                            onChange=${(event) => changeCustomerForm('full_name', event.target.value)}
                            placeholder="Nguyễn Văn A"
                          />
                          ${fieldError(customerMessage && customerMessage.fields, 'full_name')
                            ? html`<small className="field-error">${fieldError(customerMessage && customerMessage.fields, 'full_name')}</small>`
                            : null}
                        </label>
                        <label className="field">
                          <span>Số điện thoại *</span>
                          <input
                            className=${inputClass(customerMessage && customerMessage.fields, 'phone')}
                            value=${customerForm.phone}
                            onChange=${(event) => changeCustomerForm('phone', event.target.value)}
                          />
                        </label>
                        <label className="field">
                          <span>Email</span>
                          <input
                            className=${inputClass(customerMessage && customerMessage.fields, 'email')}
                            value=${customerForm.email}
                            onChange=${(event) => changeCustomerForm('email', event.target.value)}
                            placeholder="khachhang@email.com"
                          />
                        </label>
                        <label className="field">
                          <span>Địa chỉ</span>
                          <input
                            className=${inputClass(customerMessage && customerMessage.fields, 'address')}
                            value=${customerForm.address}
                            onChange=${(event) => changeCustomerForm('address', event.target.value)}
                            placeholder="Số nhà, đường, quận/huyện"
                          />
                        </label>
                        <div className="span-2 form-actions">
                          <button className="btn" type="button" onClick=${() => { resetCustomerSelection(); setShowCustomerForm(false); }}>Huỷ</button>
                          <button className="btn primary" type="button" onClick=${createNewCustomer} disabled=${customerLoading}>
                            ${customerLoading ? 'Đang tạo...' : 'Tạo hồ sơ khách hàng'}
                          </button>
                        </div>
                      </div>
                    `
                  : null}
              </div>
            </section>

            <section className="panel">
              <header className="panel-header">
                <div className="step-badge">2</div>
                <h2 className="panel-title">Thiết bị & bảo hành · QT-03, QT-05</h2>
              </header>
              <div className="panel-body">
                <div className="lookup-row">
                  <label className="field">
                    <span>Serial / IMEI</span>
                    <input
                      className=${inputClass(deviceMessage && deviceMessage.fields, 'serial_no')}
                      value=${serial}
                      placeholder="Ví dụ: SN541017338391"
                      onChange=${(event) => changeSerial(event.target.value)}
                      onKeyDown=${(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          lookupDeviceBySerial();
                        }
                      }}
                    />
                    ${fieldError(deviceMessage && deviceMessage.fields, 'serial_no')
                      ? html`<small className="field-error">${fieldError(deviceMessage && deviceMessage.fields, 'serial_no')}</small>`
                      : null}
                  </label>
                  <button className="btn primary" type="button" onClick=${lookupDeviceBySerial} disabled=${deviceLoading || !customer}>
                    ${deviceLoading ? 'Đang tra cứu...' : 'Tra cứu thiết bị'}
                  </button>
                </div>

                ${deviceMessage
                  ? html`<div className=${`inline-alert ${deviceMessage.type === 'error' || deviceMessage.type === 'warning' ? 'error' : ''}`}>${deviceMessage.text}<${RequestId} value=${deviceMessage.requestId} /></div>`
                  : null}

                ${deviceResult && deviceResult.device
                  ? html`
                      <div className="lookup-result">
                        <div>
                          <strong>${deviceResult.device.product_name}</strong>
                          <span>Serial ${deviceResult.device.serial_no} · ${deviceResult.device.device_id}</span>
                          <div className="cell-sub">
                            Ngày mua: ${deviceResult.device.purchase_date ? formatDate(deviceResult.device.purchase_date) : 'Chưa xác minh'} ·
                            Bảo hành ${deviceResult.device.warranty_months} tháng
                          </div>
                        </div>
                        <${WarrantyPill} value=${deviceResult.conBaoHanh} />
                      </div>
                      <div className=${`warranty-box ${deviceResult.conBaoHanh === false ? 'off' : deviceResult.conBaoHanh === null ? 'unknown' : ''}`}>
                        <h4>${deviceResult.ketLuanBaoHanh}</h4>
                        <p>
                          ${deviceResult.conBaoHanh === null
                            ? 'Thiếu ngày mua nên chưa thể kết luận (QT-05). Không được hiểu là hết bảo hành.'
                            : deviceResult.ngayHetHan
                              ? `Ngày hết hạn bảo hành: ${formatDate(deviceResult.ngayHetHan)}.`
                              : 'Đã kiểm tra theo ngày mua và số tháng bảo hành.'}
                        </p>
                      </div>
                    `
                  : null}

                ${showDeviceForm
                  ? html`
                      <div className="form-grid">
                        <label className="field">
                          <span>Tên thiết bị *</span>
                          <input
                            className=${inputClass(deviceMessage && deviceMessage.fields, 'product_name')}
                            value=${deviceForm.product_name}
                            onChange=${(event) => changeDeviceForm('product_name', event.target.value)}
                            placeholder="Samsung Galaxy A15"
                          />
                          ${fieldError(deviceMessage && deviceMessage.fields, 'product_name')
                            ? html`<small className="field-error">${fieldError(deviceMessage && deviceMessage.fields, 'product_name')}</small>`
                            : null}
                        </label>
                        <label className="field">
                          <span>Serial / IMEI *</span>
                          <input
                            className=${inputClass(deviceMessage && deviceMessage.fields, 'serial_no')}
                            value=${deviceForm.serial_no}
                            onChange=${(event) => changeDeviceForm('serial_no', event.target.value)}
                          />
                        </label>
                        <label className="field">
                          <span>Ngày mua (để trống nếu chưa xác minh)</span>
                          <input
                            className=${inputClass(deviceMessage && deviceMessage.fields, 'purchase_date')}
                            type="date"
                            value=${deviceForm.purchase_date}
                            onChange=${(event) => changeDeviceForm('purchase_date', event.target.value)}
                          />
                        </label>
                        <label className="field">
                          <span>Số tháng bảo hành</span>
                          <input
                            className=${inputClass(deviceMessage && deviceMessage.fields, 'warranty_months')}
                            type="number"
                            min="0"
                            max="120"
                            value=${deviceForm.warranty_months}
                            onChange=${(event) => changeDeviceForm('warranty_months', event.target.value)}
                          />
                        </label>
                        <div className="span-2 form-actions">
                          <button className="btn" type="button" onClick=${() => resetDeviceSelection(false)}>Huỷ</button>
                          <button className="btn primary" type="button" onClick=${createNewDevice} disabled=${deviceLoading}>
                            ${deviceLoading ? 'Đang tạo...' : 'Tạo thiết bị'}
                          </button>
                        </div>
                      </div>
                    `
                  : null}
              </div>
            </section>

            <section className="panel">
              <header className="panel-header">
                <div className="step-badge">3</div>
                <h2 className="panel-title">Mô tả lỗi & phân loại · UC4, UC5, FR5</h2>
              </header>
              <div className="panel-body">
                <div className="form-grid">
                  <label className="field">
                    <span>Nhóm sự cố *</span>
                    <select
                      className=${selectClass(saveError && saveError.fields, 'category_id')}
                      value=${ticketForm.category_id}
                      onChange=${changeCategory}
                    >
                      <option value="">Chọn nhóm sự cố</option>
                      ${((catalogs && catalogs.categories) || []).map(
                        (category) => html`
                          <option key=${category.category_id} value=${category.category_id}>
                            ${categoryLabel(category.category_name)} (${PRIORITY_LABELS[category.default_priority]})
                          </option>
                        `
                      )}
                    </select>
                    ${fieldError(saveError && saveError.fields, 'category_id')
                      ? html`<small className="field-error">${fieldError(saveError && saveError.fields, 'category_id')}</small>`
                      : null}
                  </label>

                  <label className="field">
                    <span>Mức ưu tiên *</span>
                    <select
                      className=${selectClass(saveError && saveError.fields, 'priority')}
                      value=${ticketForm.priority}
                      onChange=${(event) => {
                        const priority = event.target.value;
                        setTicketForm((current) => ({
                          ...current,
                          priority,
                          priority_reason:
                            selectedCategory && priority === selectedCategory.default_priority
                              ? ''
                              : current.priority_reason
                        }));
                      }}
                    >
                      <option value="">Chọn mức ưu tiên</option>
                      ${['CAO', 'TRUNG_BINH', 'THAP'].map(
                        (priority) => html`<option key=${priority} value=${priority}>${PRIORITY_LABELS[priority]}</option>`
                      )}
                    </select>
                    ${selectedCategory
                      ? html`<small className="hint">Gợi ý theo nhóm: ${PRIORITY_LABELS[selectedCategory.default_priority]}</small>`
                      : null}
                  </label>

                  <label className="field span-2">
                    <span>Mô tả lỗi khách kể * (tối thiểu 10 ký tự)</span>
                    <textarea
                      className=${textareaClass(saveError && saveError.fields, 'issue_desc')}
                      value=${ticketForm.issue_desc}
                      onChange=${(event) => setTicketForm({ ...ticketForm, issue_desc: event.target.value })}
                      placeholder="Ví dụ: Màn hình bị sọc và không hiển thị khi mở máy..."
                    />
                    ${fieldError(saveError && saveError.fields, 'issue_desc')
                      ? html`<small className="field-error">${fieldError(saveError && saveError.fields, 'issue_desc')}</small>`
                      : null}
                  </label>

                  <div className="field span-2">
                    <span className="field-label">Phụ kiện đi kèm</span>
                    <div className="check-grid">
                      ${ACCESSORY_OPTIONS.map(
                        (option) => html`
                          <label key=${option.value} className="check-item">
                            <input
                              type="checkbox"
                              checked=${ticketForm.accessories.includes(option.value)}
                              onChange=${() => toggleAccessory(option.value)}
                            />
                            ${option.label}
                          </label>
                        `
                      )}
                    </div>
                  </div>

                  <label className="field span-2">
                    <span>Tình trạng ngoại quan</span>
                    <input
                      className=${inputClass(saveError && saveError.fields, 'exterior_note')}
                      value=${ticketForm.exterior_note}
                      onChange=${(event) => setTicketForm({ ...ticketForm, exterior_note: event.target.value })}
                      placeholder="Ví dụ: Trầy xước góc phải, không móp..."
                    />
                  </label>

                  ${priorityChanged
                    ? html`
                        <label className="field span-2">
                          <span>Lý do đổi mức ưu tiên *</span>
                          <textarea
                            className=${textareaClass(saveError && saveError.fields, 'priority_reason')}
                            value=${ticketForm.priority_reason}
                            onChange=${(event) => setTicketForm({ ...ticketForm, priority_reason: event.target.value })}
                            placeholder="Ví dụ: Khách cần máy gấp để đi công tác, đã được quản lý duyệt..."
                          />
                          ${fieldError(saveError && saveError.fields, 'priority_reason')
                            ? html`<small className="field-error">${fieldError(saveError && saveError.fields, 'priority_reason')}</small>`
                            : null}
                        </label>
                      `
                    : null}
                </div>

                ${selectedCategory
                  ? html`
                      <div className="priority-preview">
                        <span>
                          Nhóm <strong>${categoryLabel(selectedCategory.category_name)}</strong> gợi ý ưu tiên
                          <strong>${PRIORITY_LABELS[selectedCategory.default_priority]}</strong>.
                        </span>
                        <span className="hint">QT-04 · T2–T7, bỏ Chủ Nhật</span>
                      </div>
                    `
                  : null}
              </div>
            </section>
          </div>

          <aside style=${{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <section className="panel">
              <header className="panel-header">
                <div className="step-badge">4</div>
                <h2 className="panel-title">Xác nhận & lưu phiếu</h2>
              </header>
              <div className="panel-body">
                <div className="info-grid">
                  <div className="info-item">
                    <div className="info-label">Khách hàng</div>
                    <div className="info-value">${customer ? customer.full_name : 'Chưa chọn'}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Thiết bị</div>
                    <div className="info-value">${deviceResult && deviceResult.device ? deviceResult.device.product_name : 'Chưa chọn'}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Serial</div>
                    <div className="info-value">${deviceResult && deviceResult.device ? deviceResult.device.serial_no : '—'}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Bảo hành</div>
                    <div className="info-value">
                      <${WarrantyPill} value=${deviceResult ? deviceResult.conBaoHanh : null} />
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Trung tâm</div>
                    <div className="info-value">
                      ${centerName(centerId, catalogs)}
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Mức ưu tiên</div>
                    <div className="info-value">
                      <${PriorityPill} priority=${ticketForm.priority} />
                    </div>
                  </div>
                </div>

                <div className="divider"></div>

                <div className="priority-preview">
                  <div>
                    <div className="info-label">Hạn cam kết dự kiến · QT-04</div>
                    <strong style=${{ fontSize: '15px' }}>
                      ${preview && preview.due_date ? formatDateTime(preview.due_date) : 'Chọn nhóm sự cố để tính'}
                    </strong>
                    <div className="cell-sub">
                      ${preview
                        ? `${preview.sla_hours} giờ làm việc · Thứ Hai – Thứ Bảy`
                        : 'Hạn được tính tự động, không nhập tay.'}
                    </div>
                  </div>
                  ${previewLoading ? html`<span className="spinner"></span>` : null}
                </div>

                ${saveError
                  ? html`
                      <div className="inline-alert error">
                        <strong>${saveError.message}</strong>
                        <${RequestId} value=${saveError.code} />
                        ${saveError.fields && Object.keys(saveError.fields).length > 0
                          ? html`
                              <ul style=${{ margin: '7px 0 0', paddingLeft: '18px' }}>
                                ${Object.entries(saveError.fields).map(
                                  ([key, value]) => html`<li key=${key}>${value}</li>`
                                )}
                              </ul>
                            `
                          : null}
                      </div>
                    `
                  : null}

                <div className="form-actions">
                  <button className="btn" type="button" onClick=${onCancel}>Huỷ</button>
                  <button className="btn primary" type="button" onClick=${saveTicket} disabled=${saving || customerLoading || deviceLoading || !customer || !deviceResult || !deviceResult.device || deviceResult.device.customer_id !== customer.customer_id}>
                    ${saving ? 'Đang lưu...' : 'Lưu phiếu · trạng thái MOI'}
                  </button>
                </div>

                <p className="hint">
                  Khi lưu, hệ thống sinh mã BH-xxxxxx/năm, ghi 1 bản ghi ticket_status_log
                  với bước chuyển null → MOI và giữ hạn cam kết đã tính.
                </p>
              </div>
            </section>

            <section className="panel">
              <header className="panel-header">
                <div className="step-badge">i</div>
                <h2 className="panel-title">Quy tắc đang áp dụng</h2>
              </header>
              <div className="panel-body" style=${{ gap: '9px', fontSize: '12.5px', color: '#475467' }}>
                <div><strong>QT-01/02:</strong> SĐT duy nhất, chuẩn hóa 10 chữ số bắt đầu bằng 0.</div>
                <div><strong>QT-03:</strong> Serial duy nhất; một thiết bị chỉ có một phiếu mở.</div>
                <div><strong>QT-04:</strong> CAO 24h, TRUNG_BINH 72h, THAP 120h; bỏ Chủ Nhật.</div>
                <div><strong>QT-05:</strong> Thiếu ngày mua → chưa xác minh, không phải hết bảo hành.</div>
                <div><strong>QT-06:</strong> Tiếp nhận kết thúc ở MOI; trạng thái và lịch sử cũ chỉ để tra cứu.</div>
              </div>
            </section>
          </aside>
        </fieldset>
      </section>
    `;
  }

  function TicketDetail({ ticketId, onBack }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const detailRequest = useRef(0);

    const load = useCallback(async () => {
      const request = ++detailRequest.current;
      setLoading(true);
      setError(null);
      setDetail(null);
      try {
        const result = await api.getTicket(ticketId);
        if (request !== detailRequest.current) return;
        setDetail(result);
      } catch (err) {
        // Phiếu bị xóa sau khi mở danh sách là trạng thái rỗng có lối quay về.
        if (request === detailRequest.current && err.status !== 404) setError(toUiError(err, 'Chưa tải được chi tiết phiếu.'));
      } finally {
        if (request === detailRequest.current) setLoading(false);
      }
    }, [ticketId]);

    useEffect(() => {
      load();
      return () => { detailRequest.current += 1; };
    }, [load]);

    if (loading || error || !detail || !detail.ticket) {
      return html`
        <section className="page">
          <button className="back-link" type="button" onClick=${onBack}>← Danh sách phiếu</button>
          <${DataState}
            loading=${loading}
            error=${error}
            loadingText="Đang tải chi tiết phiếu bảo hành..."
            onRetry=${load}
            isEmpty=${!detail || !detail.ticket}
            emptyTitle="Không tìm thấy phiếu"
            emptyText="Phiếu không tồn tại hoặc đã được xóa. Quay về danh sách để chọn phiếu khác."
            emptyActionLabel="Về danh sách phiếu"
            onEmptyAction=${onBack}
          />
        </section>
      `;
    }

    const ticket = detail.ticket;
    const sla = ticketSla(ticket);
    const priorityHours = { CAO: 24, TRUNG_BINH: 72, THAP: 120 }[ticket.mucUuTien];

    return html`
      <section className="page">
        <div className="page-header">
          <div>
            <button className="back-link" type="button" onClick=${onBack}>← Danh sách phiếu</button>
            <h1 className="page-title" style=${{ marginTop: '6px' }}>Chi tiết phiếu bảo hành</h1>
            <p className="page-subtitle">
              Hợp đồng dữ liệu 14 khóa; số điện thoại đã che theo QT-15; lịch sử trạng thái lấy từ
              bảng ticket_status_log.
            </p>
          </div>
          <${Pill} tone=${sla.tone}>${sla.label} · ${sla.detail}<//>
        </div>

        <div className="detail-grid">
          <article className="detail-card">
            <div className="detail-hero">
              <div className="detail-hero-top">
                <div>
                  <h2 className="detail-code">${ticket.ticketCode}</h2>
                  <p>
                    ${ticket.ticketId} · Tiếp nhận ${formatDateTime(ticket.ngayTiepNhan)} ·
                    ${ticket.trungTam}
                  </p>
                </div>
                <div className="hero-pills">
                  <${StatusPill} status=${ticket.trangThai} />
                  <${PriorityPill} priority=${ticket.mucUuTien} />
                  <${WarrantyPill} value=${ticket.conBaoHanh} />
                </div>
              </div>
            </div>

            <div className="detail-body">
              <div className="info-grid">
                <div className="info-item">
                  <div className="info-label">Khách hàng</div>
                  <div className="info-value">${ticket.tenKhach}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Số điện thoại · QT-15</div>
                  <div className="info-value">${ticket.sdtHienThi}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Thiết bị</div>
                  <div className="info-value">${ticket.tenThietBi}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Serial / IMEI</div>
                  <div className="info-value">${ticket.serialNo}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Nhóm sự cố</div>
                  <div className="info-value">${categoryLabel(ticket.nhomSuCo)}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Trung tâm</div>
                  <div className="info-value">${ticket.trungTam}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Hạn cam kết · QT-04</div>
                  <div className="info-value">${formatDateTime(ticket.hanCamKet)}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Kết luận bảo hành · QT-05</div>
                  <div className="info-value">${ticket.ketLuanBaoHanh}</div>
                </div>
              </div>

              <div>
                <div className="info-label" style=${{ marginBottom: '6px' }}>Mô tả lỗi</div>
                <div className="issue-box">${detail.moTaLoi || 'Chưa có mô tả lỗi.'}</div>
              </div>

              ${detail.phuKien && detail.phuKien.length > 0
                ? html`
                    <div>
                      <div className="info-label" style=${{ marginBottom: '6px' }}>Phụ kiện đi kèm</div>
                      <div className="check-grid">
                        ${detail.phuKien.map(
                          (item) => html`<span className="check-item" key=${item}>${accessoryLabel(item)}</span>`
                        )}
                      </div>
                    </div>
                  `
                : null}

              ${detail.ngoaiQuan
                ? html`
                    <div>
                      <div className="info-label" style=${{ marginBottom: '6px' }}>Tình trạng ngoại quan</div>
                      <div className="issue-box">${detail.ngoaiQuan}</div>
                    </div>
                  `
                : null}

              ${detail.lyDoUuTien
                ? html`<div className="inline-alert">Lý do mức ưu tiên: ${detail.lyDoUuTien}</div>`
                : null}

              <div className="divider"></div>

              <div>
                <h3 className="panel-title" style=${{ marginBottom: '10px' }}>Lịch sử trạng thái · QT-06</h3>
                <div className="timeline">
                  ${detail.lichSuTrangThai.length === 0
                    ? html`<div className="hint">Chưa có bản ghi lịch sử trạng thái.</div>`
                    : detail.lichSuTrangThai.map(
                        (log) => html`
                          <div className="timeline-item" key=${log.logId}>
                            <div className="timeline-dot"></div>
                            <div className="timeline-body">
                              <div className="timeline-top">
                                ${log.fromStatus
                                  ? html`<${Pill} tone=${statusTone(log.fromStatus)}>${STATUS_LABELS[log.fromStatus] || log.fromStatus}<//>
                                      <span className="cell-sub">→</span>`
                                  : html`<span className="cell-sub">Khởi tạo →</span>`}
                                <${Pill} tone=${statusTone(log.toStatus)}>${STATUS_LABELS[log.toStatus] || log.toStatus}<//>
                              </div>
                              <div className="timeline-note">${log.note || 'Không có ghi chú.'}</div>
                              <div className="timeline-meta">
                                ${formatDateTime(log.changedAt)} · ${log.changedBy}
                              </div>
                            </div>
                          </div>
                        `
                      )}
                </div>
              </div>
            </div>
          </article>

          <aside style=${{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <section className="panel">
              <header className="panel-header">
                <div className="step-badge">SLA</div>
                <h2 className="panel-title">Ngữ cảnh so sánh</h2>
              </header>
              <div className="panel-body">
                <div className="info-grid">
                  <div className="info-item">
                    <div className="info-label">Mục tiêu</div>
                    <div className="info-value">${priorityHours || '—'} giờ làm việc</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Mức ưu tiên</div>
                    <div className="info-value"><${PriorityPill} priority=${ticket.mucUuTien} /></div>
                  </div>
                </div>
                <div className=${`warranty-box ${sla.tone === 'red' ? 'off' : sla.tone === 'amber' ? 'unknown' : ''}`}>
                  <h4>${sla.label} · ${sla.detail}</h4>
                  <p>Hạn cam kết: ${formatDateTime(ticket.hanCamKet)}. Ngày làm việc Thứ Hai – Thứ Bảy, bỏ Chủ Nhật.</p>
                </div>
                <div className="hint">
                  Ngữ cảnh này giúp nhân viên so sánh thời gian còn lại với mục tiêu SLA của từng mức ưu tiên.
                </div>
              </div>
            </section>

            <div className="inline-alert">Tiếp nhận kết thúc ở trạng thái MOI. Trạng thái và lịch sử hiện có chỉ để tra cứu.</div>
          </aside>
        </div>
      </section>
    `;
  }

  function App() {
    const [session, setSession] = useState(() => api.getSession());
    const [screen, setScreen] = useState('list');
    const [selectedTicketId, setSelectedTicketId] = useState(null);
    const [catalogs, setCatalogs] = useState(null);
    const [catalogsLoading, setCatalogsLoading] = useState(false);
    const [catalogsError, setCatalogsError] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const catalogRequest = useRef(0);

    const loadCatalogs = useCallback(async () => {
      const currentSession = api.getSession();
      if (!currentSession || !currentSession.user || currentSession.user.role !== 'NHAN_VIEN') return;
      const request = ++catalogRequest.current;
      const isCurrent = () => request === catalogRequest.current && api.getSession() && api.getSession().token === currentSession.token;
      setCatalogsLoading(true);
      setCatalogsError(null);
      try {
        const data = await api.getCatalogs();
        if (isCurrent()) setCatalogs(data);
      } catch (err) {
        if (isCurrent()) setCatalogsError(err);
      } finally {
        if (isCurrent()) setCatalogsLoading(false);
      }
    }, []);

    useEffect(() => {
      if (session) loadCatalogs();
      return () => { catalogRequest.current += 1; };
    }, [session, loadCatalogs]);

    useEffect(() => {
      function onUnauthorized() {
        setSession(null);
        setSelectedTicketId(null);
        setScreen('list');
        setCatalogs(null);
        setCatalogsError(null);
        setCatalogsLoading(false);
      }
      window.addEventListener('auth:unauthorized', onUnauthorized);
      return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
    }, []);

    function handleLogin(nextSession) {
      setSession(nextSession);
      setScreen('list');
      setRefreshKey((value) => value + 1);
    }

    function handleLogout() {
      api.logout();
      setSession(null);
      setSelectedTicketId(null);
      setScreen('list');
      setCatalogs(null);
    }

    function openTicket(ticketId) {
      setSelectedTicketId(ticketId);
      setScreen('detail');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function refresh() {
      setRefreshKey((value) => value + 1);
    }

    if (!session) {
      return html`<${LoginScreen} onLogin=${handleLogin} />`;
    }

    const user = session.user || {};

    if (user.role !== 'NHAN_VIEN') {
      return html`<section className="page"><div className="inline-alert error">Giao diện này chỉ dành cho nhân viên tiếp nhận.</div><button className="btn" type="button" onClick=${handleLogout}>Đăng xuất</button></section>`;
    }

    return html`
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">MM</div>
            <div>
              <h1 className="brand-title">Smart CRM · Mekong Mobile</h1>
              <p className="brand-subtitle">
                Luồng L2 · Tiếp nhận và phân loại yêu cầu bảo hành · ${centerName(user.center_id, catalogs)}
              </p>
            </div>
          </div>
          <div className="user-area">
            <div className="user-chip">
              <div className="avatar">${initials(user.fullName)}</div>
              <div>
                <div className="user-name">${user.fullName || user.username}</div>
                <div className="user-role">${ROLE_LABELS[user.role] || user.role} · ${centerName(user.center_id, catalogs)}</div>
              </div>
            </div>
            <button className="btn small" type="button" onClick=${handleLogout}>Đăng xuất</button>
          </div>
        </header>

        <nav className="nav-tabs">
          <button
            className=${`nav-tab ${screen === 'list' || screen === 'detail' ? 'active' : ''}`}
            type="button"
            onClick=${() => {
              setScreen('list');
              setSelectedTicketId(null);
            }}
          >
            Danh sách phiếu
          </button>
          <button
            className=${`nav-tab ${screen === 'intake' ? 'active' : ''}`}
            type="button"
            onClick=${() => setScreen('intake')}
          >
            + Tiếp nhận phiếu mới
          </button>
        </nav>

        ${screen === 'list'
          ? html`
              <${TicketList}
                catalogs=${catalogs}
                refreshKey=${refreshKey}
                onOpen=${openTicket}
                onNew=${() => setScreen('intake')}
                onReloadCatalogs=${loadCatalogs}
              />
            `
          : null}

        ${screen === 'intake'
          ? html`
              <${IntakeScreen}
                session=${session}
                catalogs=${catalogs}
                catalogsLoading=${catalogsLoading}
                catalogsError=${catalogsError}
                onReloadCatalogs=${loadCatalogs}
                onCreated=${(ticketId) => {
                  refresh();
                  openTicket(ticketId);
                }}
                onCancel=${() => setScreen('list')}
              />
            `
          : null}

        ${screen === 'detail' && selectedTicketId
          ? html`
              <${TicketDetail}
                ticketId=${selectedTicketId}
                onBack=${() => {
                  setScreen('list');
                  setSelectedTicketId(null);
                }}
              />
            `
          : null}

        <footer className="page-footer">
          Prototype học phần · Smart CRM Mekong Mobile · Dữ liệu mẫu từ case study ·
          Nguyễn Duy Khang · 2374802010212
        </footer>
      </div>
    `;
  }

  ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
})();
