# RideX — Tài liệu khóa luận

Bộ tài liệu khóa luận tốt nghiệp gồm báo cáo chính, slide thuyết trình, và 12 sơ đồ.

## Cấu trúc

```
thesis/
├── 00-outline.md          # Đề cương + cấu trúc — đọc trước
├── 01-thesis.md           # Báo cáo chính (~80 trang khi render Word)
├── 02-slides.md           # Slide Marp (~22 slide)
├── metadata.yml           # Metadata cho Pandoc
├── README.md              # File này
└── diagrams/              # 12 sơ đồ Mermaid + PlantUML
    ├── 01-architecture.mmd
    ├── 02-use-case.puml
    ├── 03-erd.mmd
    ├── 04-state-ride.mmd
    ├── 05-state-payment.mmd
    ├── 06-seq-request-ride.mmd
    ├── 07-seq-matching.mmd
    ├── 08-seq-in-ride.mmd
    ├── 09-seq-payment.mmd
    ├── 10-deployment.mmd
    ├── 11-module-dependency.mmd
    └── 12-h3-discovery.mmd
```

## Cài công cụ build (một lần)

### Pandoc (để build Word + slide)

```bash
# Windows
scoop install pandoc        # hoặc choco install pandoc

# macOS
brew install pandoc

# Linux
sudo apt install pandoc
```

### Mermaid CLI (để render sơ đồ Mermaid thành PNG/SVG)

```bash
npm install -g @mermaid-js/mermaid-cli
```

### PlantUML (để render sơ đồ PlantUML — chỉ cần cho `02-use-case.puml`)

```bash
# Windows
scoop install plantuml

# macOS
brew install plantuml

# Linux
sudo apt install plantuml
```

### Marp CLI (để build slide PPTX)

```bash
npm install -g @marp-team/marp-cli
```

## Build sơ đồ thành PNG

Tạo thư mục xuất + render từng file:

```bash
cd docs/thesis/diagrams
mkdir -p png

# Mermaid
for f in *.mmd; do
  mmdc -i "$f" -o "png/${f%.mmd}.png" -b transparent -s 2
done

# PlantUML
plantuml -tpng -o png 02-use-case.puml
```

PowerShell (Windows):

```powershell
cd docs/thesis/diagrams
New-Item -ItemType Directory -Force png | Out-Null

Get-ChildItem *.mmd | ForEach-Object {
  mmdc -i $_.Name -o "png/$($_.BaseName).png" -b transparent -s 2
}
plantuml -tpng -o png 02-use-case.puml
```

## Build báo cáo `.docx`

Sau khi sơ đồ đã có file PNG trong `diagrams/png/`, **sửa các `![](.../diagrams/XX.mmd)` trong `01-thesis.md` thành `![](.../diagrams/png/XX.png)`** rồi:

```bash
cd docs/thesis
pandoc 01-thesis.md \
  --metadata-file=metadata.yml \
  --toc --toc-depth=3 \
  --number-sections \
  -o thesis.docx
```

Kết quả: `thesis.docx` mở được bằng Microsoft Word, ~80 trang khi font 13pt + line spacing 1.5.

### Mẹo: dùng reference template trường

Nếu trường có file `template.docx` chứa style heading/font sẵn:

```bash
pandoc 01-thesis.md \
  --metadata-file=metadata.yml \
  --reference-doc=template.docx \
  --toc --toc-depth=3 \
  --number-sections \
  -o thesis.docx
```

Pandoc sẽ áp dụng các style từ template lên output.

## Build slide `.pptx`

```bash
cd docs/thesis
marp 02-slides.md --pptx -o slides.pptx
```

Hoặc xem trước trong trình duyệt:

```bash
marp 02-slides.md --html -o slides.html
# Mở slides.html
```

Hoặc qua Pandoc (alternative):

```bash
pandoc 02-slides.md -t pptx -o slides-pandoc.pptx
```

## Sửa thông tin cá nhân

Trước khi build cuối cùng, mở `01-thesis.md` và `02-slides.md`, replace các placeholder:

- `[MSSV]` → mã số sinh viên thật
- `[Học hàm, Học vị, Họ và tên Giảng viên hướng dẫn]` → tên GVHD đầy đủ
- `[Tên Khoa]`, `[Tên Trường]` → tên đầy đủ
- `[GVHD]` → bí danh ngắn của thầy/cô

Tip: dùng VS Code "Find in Files" với case-sensitive để soát hết.

## Checklist trước khi nộp

- [ ] Đã điền thông tin cá nhân vào `01-thesis.md` + `02-slides.md`
- [ ] Đã render 12 sơ đồ ra PNG
- [ ] Đã update đường dẫn `diagrams/png/*.png` trong markdown
- [ ] Đã build `thesis.docx`, mở Word kiểm tra format
- [ ] Đã build `slides.pptx`, mở PowerPoint kiểm tra layout
- [ ] Đã chèn screenshot demo vào slide 14-16 (placeholder hiện tại)
- [ ] Đã update list of figures, list of tables (Word có thể auto qua References > Insert Table of Figures)
- [ ] Đã đánh số trang đúng quy định trường (Word: Insert > Page Numbers)
- [ ] Đã in 2-3 bản nộp + 1 bản lưu

## Câu hỏi thường gặp

**Q: Mermaid render lỗi font tiếng Việt?**
A: Mermaid CLI dùng Chromium headless. Cần config font tiếng Việt trong file `puppeteer-config.json`:
```json
{ "args": ["--font-render-hinting=none"] }
```
Truyền qua: `mmdc -p puppeteer-config.json -i ...`

**Q: Mermaid không hỗ trợ tiếng Việt có dấu trong node label?**
A: Hỗ trợ. Nếu lỗi rendering, escape các ký tự đặc biệt (dấu nháy đơn, dấu ngoặc) bằng `\`.

**Q: Pandoc báo lỗi LaTeX khi build docx?**
A: docx output không dùng LaTeX, chỉ cần Pandoc thuần. Nếu báo lỗi liên quan `\newpage`, đó là LaTeX-only command nhưng Pandoc hiểu khi build docx. Nếu vẫn lỗi, thay `\newpage` bằng `<div style="page-break-after: always;"></div>`.

**Q: Slide bị crop trên PowerPoint?**
A: Marp size mặc định 16:9. Nếu trường yêu cầu 4:3, sửa frontmatter `size: 4:3`.
