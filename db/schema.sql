-- =====================================================================
-- Smart CRM – Mekong Mobile
-- DDL skeleton chuẩn hóa 3NF cho Luồng L2 – Tiếp nhận và phân loại
-- yêu cầu bảo hành (Track SE).
--
-- Sáu bảng dưới đây là nguồn tham chiếu cho 6 Mongoose Schema trong
-- src/models/schemas.js. Tệp DDL đã được rà soát, không còn dòng giữ chỗ.
-- =====================================================================

CREATE TABLE service_center (
    center_id    VARCHAR(20)  NOT NULL,
    center_code  VARCHAR(20)  NOT NULL,
    center_name  VARCHAR(120) NOT NULL,
    city         VARCHAR(60)  NOT NULL,
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_service_center PRIMARY KEY (center_id),
    CONSTRAINT uq_service_center_code UNIQUE (center_code),
    CONSTRAINT uq_service_center_name UNIQUE (center_name)
);

CREATE TABLE issue_category (
    category_id       VARCHAR(20) NOT NULL,
    category_name     VARCHAR(30) NOT NULL,
    default_priority  VARCHAR(20) NOT NULL,
    is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_issue_category PRIMARY KEY (category_id),
    CONSTRAINT uq_issue_category_name UNIQUE (category_name),
    CONSTRAINT ck_issue_category_name CHECK (
        category_name IN ('MAN_HINH', 'PIN', 'SAC', 'PHAN_MEM', 'NUOC_VAO', 'KHAC')
    ),
    CONSTRAINT ck_issue_category_priority CHECK (
        default_priority IN ('CAO', 'TRUNG_BINH', 'THAP')
    )
);

CREATE TABLE customer (
    customer_id  VARCHAR(20)  NOT NULL,
    full_name    VARCHAR(120) NOT NULL,
    phone        CHAR(10)     NOT NULL,
    email        VARCHAR(120),
    address      VARCHAR(255) NOT NULL DEFAULT '',
    segment      VARCHAR(20)  NOT NULL DEFAULT 'THUONG',
    created_at   DATE         NOT NULL,
    is_deleted   BOOLEAN      NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_customer PRIMARY KEY (customer_id),
    CONSTRAINT uq_customer_phone UNIQUE (phone),
    CONSTRAINT ck_customer_phone CHECK (CHAR_LENGTH(phone) = 10 AND phone LIKE '0%'),
    CONSTRAINT ck_customer_segment CHECK (segment IN ('VIP', 'THUONG', 'MOI'))
);

CREATE TABLE device (
    device_id       VARCHAR(20)  NOT NULL,
    customer_id     VARCHAR(20)  NOT NULL,
    product_id      INTEGER,
    product_code    VARCHAR(30),
    product_name    VARCHAR(120) NOT NULL,
    serial_no       VARCHAR(40)  NOT NULL,
    purchase_date   DATE,
    warranty_months SMALLINT     NOT NULL DEFAULT 12,
    is_deleted      BOOLEAN      NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_device PRIMARY KEY (device_id),
    CONSTRAINT uq_device_serial UNIQUE (serial_no),
    CONSTRAINT fk_device_customer FOREIGN KEY (customer_id)
        REFERENCES customer (customer_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_device_warranty_months CHECK (warranty_months BETWEEN 0 AND 120)
);

CREATE TABLE ticket (
    ticket_id        VARCHAR(20)  NOT NULL,
    ticket_code      VARCHAR(20)  NOT NULL,
    customer_id      VARCHAR(20)  NOT NULL,
    device_id        VARCHAR(20)  NOT NULL,
    center_id        VARCHAR(20)  NOT NULL,
    category_id      VARCHAR(20)  NOT NULL,
    issue_desc       VARCHAR(2000) NOT NULL,
    accessories      VARCHAR(255) NOT NULL DEFAULT '',
    exterior_note    VARCHAR(500) NOT NULL DEFAULT '',
    priority         VARCHAR(20)  NOT NULL,
    priority_reason  VARCHAR(300) NOT NULL DEFAULT '',
    status           VARCHAR(20)  NOT NULL DEFAULT 'MOI',
    is_warranty      BOOLEAN,
    received_at      TIMESTAMP    NOT NULL,
    due_date         TIMESTAMP    NOT NULL,
    closed_at        TIMESTAMP,
    is_deleted       BOOLEAN      NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_ticket PRIMARY KEY (ticket_id),
    CONSTRAINT uq_ticket_code UNIQUE (ticket_code),
    CONSTRAINT fk_ticket_customer FOREIGN KEY (customer_id)
        REFERENCES customer (customer_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ticket_device FOREIGN KEY (device_id)
        REFERENCES device (device_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ticket_center FOREIGN KEY (center_id)
        REFERENCES service_center (center_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ticket_category FOREIGN KEY (category_id)
        REFERENCES issue_category (category_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_ticket_issue_desc CHECK (CHAR_LENGTH(issue_desc) BETWEEN 10 AND 2000),
    CONSTRAINT ck_ticket_priority CHECK (priority IN ('CAO', 'TRUNG_BINH', 'THAP')),
    CONSTRAINT ck_ticket_status CHECK (
        status IN ('MOI', 'DA_PHAN_CONG', 'DANG_XU_LY', 'CHO_LINH_KIEN', 'HOAN_TAT', 'DA_DONG')
    )
);

CREATE TABLE ticket_status_log (
    log_id       VARCHAR(20) NOT NULL,
    ticket_id    VARCHAR(20) NOT NULL,
    from_status  VARCHAR(20),
    to_status    VARCHAR(20) NOT NULL,
    changed_at   TIMESTAMP   NOT NULL,
    changed_by   VARCHAR(24) NOT NULL,
    note         VARCHAR(300) NOT NULL DEFAULT '',
    CONSTRAINT pk_ticket_status_log PRIMARY KEY (log_id),
    CONSTRAINT fk_log_ticket FOREIGN KEY (ticket_id)
        REFERENCES ticket (ticket_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_log_from_status CHECK (
        from_status IS NULL OR from_status IN
        ('MOI', 'DA_PHAN_CONG', 'DANG_XU_LY', 'CHO_LINH_KIEN', 'HOAN_TAT', 'DA_DONG')
    ),
    CONSTRAINT ck_log_to_status CHECK (
        to_status IN ('MOI', 'DA_PHAN_CONG', 'DANG_XU_LY', 'CHO_LINH_KIEN', 'HOAN_TAT', 'DA_DONG')
    )
);

-- Chỉ mục phục vụ tra cứu và kiểm tra xung đột nghiệp vụ.
CREATE INDEX idx_customer_phone ON customer (phone);
CREATE INDEX idx_device_customer ON device (customer_id);
CREATE INDEX idx_device_serial ON device (serial_no);
CREATE INDEX idx_ticket_customer ON ticket (customer_id);
CREATE INDEX idx_ticket_device ON ticket (device_id);
CREATE INDEX idx_ticket_center_status ON ticket (center_id, status);
CREATE INDEX idx_ticket_due_date ON ticket (due_date);
CREATE INDEX idx_log_ticket_time ON ticket_status_log (ticket_id, changed_at);

-- Ghi chú 3NF:
-- 1. service_center và issue_category là bảng danh mục độc lập.
-- 2. customer và device tách riêng; device tham chiếu customer.
-- 3. ticket chỉ lưu khóa ngoại, không lặp lại tên khách hàng hay tên thiết bị.
-- 4. ticket_status_log tách riêng để giữ toàn bộ lịch sử chuyển trạng thái (QT-06).
