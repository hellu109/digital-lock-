# 3D Digital Smart Lock Simulator (NEXLOCK PRO 3D)

Ứng dụng mô phỏng **Khóa cửa Điện tử Thông minh 3D (Digital Smart Lock)** tương tác trực quan với đồ họa WebGL (Three.js), hiệu ứng âm thanh sống động (Web Audio API), và hệ thống quản trị mô phỏng ứng dụng di động thông minh (IoT Companion App).

---

## 🌟 Tính Năng Nổi Bật

### 1. Mô Hình 3D Chân Thực & Tương Tác Trực Tiếp (Interactive 3D Lock)
- **Tương tác click trực tiếp trên vật thể 3D**:
  - Bấm phím số bàn phím cảm ứng điện dung `0-9`, `*`, `#` (phím phát sáng và thụt nhẹ phản hồi xúc giác).
  - Chạm trực tiếp vào mắt đọc vân tay trên tay nắm để quét.
  - Vùng quét thẻ từ RFID / NFC.
- **Màn hình OLED điện tử 3D**: Cập nhật trạng thái thời gian thực (*READY*, *ENTER PIN*, *UNLOCKED*, *LOCKED*, *ALARM*, v.v.).
- **Chuyển động cơ học chân thực**:
  - Hệ thống chốt an toàn **Mortise 3 chấu inox** thụt vào / nhô ra khi mở / đóng khóa.
  - Tay gạt trợ lực xoay gập xuống 32° khi mở cửa.
  - Toàn bộ cánh cửa gỗ xoay mở vào không gian phòng.
- **4 Góc quay Camera định sẵn**:
  - *Mặt trước*: Góc nhìn chuẩn đối diện thân khóa.
  - *Cận cảnh phím số*: Phóng to màn hình OLED và bàn phím.
  - *Lẫy & Chốt Mortise*: Quan sát chuyển động cơ khí thụt chốt inox.
  - *Toàn cảnh cửa*: Toàn bộ cánh cửa và căn phòng.

### 2. Đa Phương Thức Xác Thực (Multi-factor Authentication)
- **Mật mã số PIN**:
  - Mã Master mặc định: `123456#`
  - Mã Khách / OTP: `888888#`
  - **Công nghệ mã số ảo (Anti-Peep Fake PIN)**: Cho phép gõ chuỗi số bất kỳ trước hoặc sau mật khẩu thật để chống nhìn trộm (Ví dụ: `8491` + `123456` + `03#`).
- **Sinh trắc học vân tay**: Vòng LED hiển thị trạng thái (Xanh dương chờ, Cyan quét, Xanh lục chấp nhận, Đỏ từ chối).
- **Thẻ từ RFID / NFC Mifare**: Quẹt thẻ Master hoặc thẻ khách.
- **Mở khóa từ xa qua App**: 1 chạm qua kết nối Bluetooth Low Energy (BLE).

### 3. Tính Năng An Ninh & Quản Trị Thông Minh
- **Tự động khóa (Auto-Lock)**: Tự động khóa và khép cửa sau 3s / 5s / 10s.
- **Báo động chống cạy phá (Tamper Alarm)**: Còi hú cảnh báo âm thanh và đèn nháy đỏ khẩn cấp.
- **Khóa bảo vệ vô hiệu hóa (Lockout)**: Nhập sai liên tiếp 5 lần sẽ khóa hệ thống 30 giây kèm âm báo động.
- **Cổng sạc kích nguồn khẩn cấp Type-C**: Dùng pin dự phòng cấp nguồn khi hết pin.
- **Nhật ký truy cập thời gian thực (Access Logs)**: Lưu vết chi tiết từng lượt mở khóa thành công / thất bại.
- **Âm thanh tổng hợp Web Audio API**: Tự tạo tiếng bíp phím, nhạc chuông thành công, tiếng còi lỗi, âm cơ khí motor mà không cần file mp3 bên ngoài.

---

## 🚀 Hướng Dẫn Chạy Ứng Dụng

Ứng dụng hoàn toàn độc lập, bạn có thể chạy bằng các cách sau:

### Cách 1: Chạy bằng Python HTTP Server (Khuyên dùng)
Mở terminal tại thư mục này và gõ:
```bash
python -m http.server 8080 --directory "C:\Users\My PC\.gemini\antigravity\scratch\khoa-dien-tu-3d"
```
Sau đó mở trình duyệt tại: `http://localhost:8080`

### Cách 2: Chạy bằng Node.js (npx serve)
```bash
npx.cmd serve -l 8080
```

### Cách 3: Mở trực tiếp file `index.html`
Bạn chỉ cần nhấp đúp vào tệp `index.html` để mở ngay trên trình duyệt (Chrome, Edge, Firefox, Safari).

---

## 📁 Cấu Trúc Thư Mục
```
digital-lock-3d/
├── index.html       # Giao diện chính, viewport 3D và màn hình ứng dụng di động
├── styles.css       # Thiết kế Cyberpunk Glassmorphism hiện đại
├── lock3d.js        # Khởi tạo mô hình 3D Three.js, vật liệu gỗ/kim loại, animation cơ khí
├── audio.js         # Bộ tổng hợp âm thanh kỹ thuật số Web Audio API
├── app.js           # Bộ điều khiển logic, xác thực PIN/Vân tay/Thẻ từ, nhật ký truy cập
└── README.md        # Hướng dẫn chi tiết
```
