## Weather Data Warehouse Dashboard

### 1. Mục tiêu

- Hiển thị trực quan dữ liệu thời tiết (nhiệt độ, độ ẩm) được lưu trong data warehouse `datawarehouse`.
- Người dùng chọn **thành phố** → xem **chuỗi thời gian nhiều ngày** cho riêng thành phố đó.

### 2. Cấu trúc chính

- `server.js`: Backend Node.js/Express
  - Kết nối MariaDB (`datawarehouse`) bằng `mysql2`.
  - API:
    - `GET /api/cities`: trả về danh sách `city` từ bảng `dim_location`.
    - `GET /api/temperature?city=...`:
      - JOIN `fact_weather` + `dim_date` + `dim_location`.
      - Lọc theo `l.city = ?`.
      - Sắp xếp theo `d.full_date` tăng dần.
      - `LIMIT 365` → tối đa 365 bản ghi (tối đa ~1 năm cho 1 city).
      - Trả về các cột: `date`, `temperature`, `humidity`.
- `public/index.html`: Frontend
  - Giao diện đơn giản với:
    - Dropdown chọn thành phố.
    - Nút **“Tải dữ liệu”**.
    - 2 biểu đồ dùng Chart.js:
      - Line chart: Nhiệt độ theo ngày.
      - Bar chart: Độ ẩm theo ngày.

### 3. Luồng hoạt động

1. Khi mở trang:
   - Frontend gọi `GET /api/cities` để lấy danh sách thành phố.
   - Chọn city đầu tiên trong danh sách.
   - Gọi `GET /api/temperature?city=<city>` để lấy dữ liệu.
   - Vẽ 2 biểu đồ dựa trên kết quả trả về.
2. Khi người dùng:
   - Đổi thành phố trong dropdown.
   - Bấm nút **“Tải dữ liệu”**.
   - Frontend gọi lại `GET /api/temperature` với city mới, hủy chart cũ và vẽ chart mới.

### 4. Ý nghĩa dữ liệu trên chart

- Mỗi điểm (line) hoặc cột (bar) tương ứng với **1 ngày** trong bảng `fact_weather` (thông qua `dim_date.full_date`) cho **thành phố đang chọn**.
- Trục X: ngày, định dạng `dd/MM` (ví dụ: `18/11`).
- Trục Y:
  - Biểu đồ trên: giá trị `temperature_2m` (°C).
  - Biểu đồ dưới: giá trị `humidity_2m` (%).

> Lưu ý: Data warehouse có thể chứa **rất nhiều ngày cho toàn bộ các thành phố**, nhưng:
>
> - Mỗi thành phố có thể chỉ có **1 hoặc vài ngày** dữ liệu, tùy bạn đã nạp vào `fact_weather`.
> - Ví dụ: nếu trong `fact_weather` chỉ có nhiều dòng cho `date_key = 7627` (18/11) với nhiều `location_key` khác nhau, nhưng thành phố bạn chọn chỉ xuất hiện ở `date_key = 7627`, thì chart sẽ chỉ hiển thị một ngày 18/11 cho city đó.

### 5. Cách chạy

```bash
cd D:\code_nam4\DataWarehouse\ThoiTiet\weather-dashboard
npm install        # lần đầu nếu chưa cài
npm run dev        # hoặc npm start
```

Mở trình duyệt: `http://localhost:3000`

### 6. Cách mở rộng

- Thêm API mới để:
  - Tổng hợp theo tháng (`GROUP BY calendar_year, calendar_month`).
  - So sánh nhiều thành phố trên cùng một chart.
- Thêm dropdown/filter:
  - Chọn khoảng thời gian (từ ngày – đến ngày).
  - Chọn loại chỉ số (chỉ nhiệt độ, chỉ độ ẩm, cả hai).
