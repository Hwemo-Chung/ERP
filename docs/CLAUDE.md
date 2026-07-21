# vive-md Project Guide

## Project Overview
Development guide and waterfall deliverable template project for vibe coding. It provides detailed guidance so Claude Code can code directly for each technology stack or generate deliverables according to the waterfall methodology.

## Structure
```
templates/
├── spring-boot/Spring-Boot-개발가이드.md     # Spring Boot 3.x (3000+ lines)
├── vue/Vue3-개발가이드.md                     # Vue 3 + TypeScript (3000+ lines)
├── react/React-개발가이드.md                  # React 18+ + TypeScript (3000+ lines)
├── nextjs/NextJS-개발가이드.md                # Next.js 14+ App Router (2600+ lines)
├── design-system/디자인시스템-가이드.md        # UI/UX, accessibility, dark mode (2500+ lines)
├── security/보안-가이드.md                     # OWASP, authentication/authorization, API security (2900+ lines)
└── waterfall/                                       # Waterfall methodology deliverable templates
    ├── 01-요구사항분석/
    │   ├── 요구사항명세서-SRS.md
    │   ├── 유스케이스명세서.md
    │   └── 요구사항추적매트릭스-RTM.md
    ├── 02-시스템설계/
    │   ├── 시스템아키텍처설계서-SAD.md
    │   ├── 데이터베이스설계서.md
    │   ├── API설계서.md
    │   └── 화면설계서.md
    ├── 03-상세설계/
    │   └── 상세설계서.md
    ├── 05-테스트/
    │   ├── 테스트계획서.md
    │   ├── 테스트케이스.md
    │   └── 테스트결과보고서.md
    ├── 06-배포/
    │   ├── 배포계획서.md
    │   └── 운영가이드.md
    ├── 07-유지보수/
    │   └── 유지보수계획서.md
    └── 08-검토/
        ├── 단계별검토-체크리스트.md
        ├── UX검토서.md
        └── 프로젝트관리-산출물.md
```

## Document Categories

### Technology Stack Guides (6)
Development guide documents. When copied into a project, Claude Code applies best practices for security, productivity, and performance.
- Each document is 2500-3200 lines.
- 6 sections: project overview, coding conventions, security requirements, productivity guide, performance optimization, and gotchas.

### Waterfall Deliverable Templates (14+)
Standard templates for deliverables at each waterfall phase. When asked to "write an SRS", Claude Code generates the deliverable from the matching template.
- `[placeholder]` markers identify where project-specific content should be filled in.
- Includes Mermaid diagrams: flowchart, sequenceDiagram, erDiagram, classDiagram, and gantt.

### Review Documents (3)
Phase review checklist, UX review document, and project management deliverables.
- Nielsen's 10 usability heuristics evaluation.
- WCAG 2.1 AA accessibility checklist.
- Risk management, WBS, and change management.

## Writing Principles
- Write in Korean and keep technical terms in English.
- Use Markdown, with sections divided by `##`, `###`, and `####`.
- Code examples should be complete enough to copy directly into real work.
- Focus on patterns specific to each stack; omit generic software knowledge.

## When Adding a New Template
1. Create a `templates/{category}/` directory.
2. Write an `.md` file with a meaningful Korean filename; preserve existing filename/path literals when referencing them.
3. Add it to the supported templates table in `README.md`.
