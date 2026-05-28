---
title: "Khóa luận tốt nghiệp — Xây dựng nền tảng đặt xe RideX"
subtitle: "Đề cương & cấu trúc tài liệu"
author: "Lý Hải Quân"
date: "2026-05-24"
---

# Đề cương khóa luận tốt nghiệp

## Đề tài
**Nghiên cứu và xây dựng nền tảng đặt xe trực tuyến mini Uber/Grab dựa trên kiến trúc microservice với NestJS**

## Bố cục tài liệu

### A. Báo cáo chính (`01-thesis.md` → `thesis.docx`)
~70-90 trang, sẽ generate bằng Pandoc.

| Phần | Trang dự kiến | Nội dung |
|---|---|---|
| Trang bìa, bìa phụ | 2 | Theo template trường |
| Lời cam đoan | 1 | Cam kết tự thực hiện |
| Lời cảm ơn | 1 | GVHD + bạn bè + gia đình *(cần bạn điền tên GVHD)* |
| Tóm tắt (VN) | 1 | Abstract tiếng Việt |
| Abstract (EN) | 1 | English abstract |
| Mục lục, danh mục hình, bảng, viết tắt | 4-5 | Auto-generate qua Pandoc |
| **Mở đầu** | 3-4 | Lý do, mục tiêu, phạm vi, phương pháp, bố cục |
| **Chương 1 — Tổng quan đề tài** | 8-10 | Bài toán ride-hailing, các nền tảng hiện có (Grab, Be, Gojek), khoảng trống nghiên cứu, đóng góp của khóa luận |
| **Chương 2 — Cơ sở lý thuyết** | 12-15 | NestJS, Domain-Driven Design, Facade pattern, JWT + Argon2, H3 geospatial, OSRM routing, state machine, idempotency, event-driven, Socket.IO realtime, BullMQ, TypeORM, Next.js + Expo, TanStack Query |
| **Chương 3 — Phân tích & thiết kế hệ thống** | 18-22 | Use case, sequence diagram (đặt xe, matching, in-ride, payment), ERD, state machine ride/payment, kiến trúc module, phân chia bounded context, sơ đồ deploy |
| **Chương 4 — Cài đặt & kết quả** | 15-20 | Tech stack chi tiết, key implementation (matching engine + H3, pricing surge, payment idempotency, WS gateway, FE state mgmt), test coverage (483 tests), demo screenshots, performance |
| **Kết luận & hướng phát triển** | 3-4 | Kết quả đạt được, hạn chế, hướng mở rộng (Maestro CI, payment gateway thật, ML matching) |
| Tài liệu tham khảo | 2-3 | IEEE format |
| Phụ lục A — Hướng dẫn cài đặt và chạy | 3-4 | docker-compose, env, migration, seed |
| Phụ lục B — Sơ đồ chi tiết | 5-8 | Full ERD, full sequence diagrams |
| Phụ lục C — Mã nguồn nổi bật | 3-5 | Snippet matching atomic Lua, payment idempotency, state machine validator |

### B. Slide thuyết trình (`02-slides.md` → `slides.pptx`)
~18-20 slide, format Marp/Reveal → có thể export PowerPoint.

| Slide | Nội dung |
|---|---|
| 1 | Trang bìa (đề tài, tên, GVHD) |
| 2 | Mục tiêu & phạm vi |
| 3 | Bài toán giải quyết |
| 4 | Kiến trúc tổng thể (component diagram) |
| 5 | Tech stack |
| 6 | Use case |
| 7 | ERD rút gọn |
| 8 | State machine ride |
| 9 | Sequence: đặt xe + matching |
| 10 | Sequence: in-ride + payment |
| 11 | Bảo mật (JWT + Argon2 + RBAC + WS auth) |
| 12 | Matching engine (H3 + OSRM + scoring) |
| 13 | Pricing surge |
| 14 | Payment idempotency (3-layer) |
| 15 | Frontend (5 surface) |
| 16 | Test coverage (483 backend + Maestro E2E) |
| 17 | Demo screenshots |
| 18 | Kết quả đạt được |
| 19 | Hạn chế & hướng phát triển |
| 20 | Q&A |

### C. Sơ đồ (`diagrams/`)

| File | Loại | Tool |
|---|---|---|
| `01-architecture.mmd` | Component / kiến trúc tổng thể | Mermaid flowchart |
| `02-use-case.puml` | Use case diagram | PlantUML |
| `03-erd.mmd` | ERD | Mermaid erDiagram |
| `04-state-ride.mmd` | State machine ride | Mermaid stateDiagram-v2 |
| `05-state-payment.mmd` | State machine payment | Mermaid stateDiagram-v2 |
| `06-seq-request-ride.mmd` | Sequence đặt xe | Mermaid sequenceDiagram |
| `07-seq-matching.mmd` | Sequence matching engine | Mermaid sequenceDiagram |
| `08-seq-in-ride.mmd` | Sequence in-ride realtime | Mermaid sequenceDiagram |
| `09-seq-payment.mmd` | Sequence payment idempotency | Mermaid sequenceDiagram |
| `10-deployment.mmd` | Deployment Docker | Mermaid flowchart |
| `11-module-dependency.mmd` | Module dependency (NestJS bounded context) | Mermaid flowchart |
| `12-h3-discovery.mmd` | H3 driver discovery logic | Mermaid flowchart |

## Build cho Word

```bash
# Cài Pandoc
# Windows: scoop install pandoc  hoặc  choco install pandoc
# macOS:   brew install pandoc

# Cài mermaid-filter để render sơ đồ vào Word (cần Node)
npm install -g mermaid-filter

# Build thesis.docx
cd ridex/docs/thesis
pandoc 01-thesis.md \
  -o thesis.docx \
  --reference-doc=template-ref.docx \
  --toc --toc-depth=2 \
  --filter mermaid-filter \
  --number-sections \
  --metadata-file=metadata.yml

# Build slides.pptx
pandoc 02-slides.md -o slides.pptx -t pptx
# Hoặc dùng Marp: marp 02-slides.md --pptx
```

## Thông tin tôi cần bạn cung cấp

Để fill chính xác các phần personal:

| Field | Giá trị |
|---|---|
| Họ tên đầy đủ | Lý Hải Quân *(xác nhận)* |
| MSSV | ??? |
| Lớp / Khóa | ??? |
| Khoa | Công nghệ thông tin? |
| Trường | ??? |
| Giảng viên hướng dẫn (học hàm, học vị, tên) | ??? |
| Niên khóa | 2022-2026? |
| Email liên hệ | lyhaiquan020705@gmail.com *(từ memory)* |
| Tên đề tài bằng tiếng Anh | "Building a ride-hailing platform mini Uber/Grab based on microservice architecture with NestJS" *(đề xuất)* |

Bạn paste các giá trị này vào tôi sẽ điền tự động. Hoặc cứ để placeholder `[MSSV]`, `[GVHD]` để bạn tự điền sau.

## Plan triển khai

1. ✅ Tạo outline này — bạn duyệt
2. ⏳ Sinh toàn bộ sơ đồ `diagrams/*.mmd` + `.puml`
3. ⏳ Sinh `01-thesis.md` đầy đủ nội dung
4. ⏳ Sinh `02-slides.md`
5. ⏳ Hướng dẫn build .docx + .pptx + cleanup

Sau khi bạn OK outline + cung cấp info cá nhân, tôi sẽ chạy bước 2-4 liên tiếp.
