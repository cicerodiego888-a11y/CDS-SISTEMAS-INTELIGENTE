# Release Certification Report — RC4.32.0

## Ambiente

- Versão: 1.0.3
- Commit: 30478b4
- Build: 2026-08-28T03:24:29.859Z
- Hash app.asar: `e142e9d566a73e5ad7a896508c073a897aa6830dae7bfcfb8523d65e9efc9b5d`
- Origem: fonte
- Data: 2026-09-02T19:50:56.157Z

## Resultados

✔ Inicialização do ERP
  - DB ok | pacote: fonte | asar: N/A…
✔ Login
  - user=rc4320_1788378655043 perfil=SUPER_ADMIN
✔ Cadastro de Produtos
  - CRUD ok | embalagem CX×12 | codigo=RC4320-1788378654329-P
✔ Compras
  - NF-e …00000064 | status=EM_REVISAO
✔ Financeiro
  - parser financeiro OK | parcela R$500 | registros financeiro=8
✔ Estoque
  - fiscal=6+3 | total=15 UN
✔ MIIP
  - MUC 10×12 → 120 UN (MULTIPLICADOR)
✔ Central Inteligente
  - documento 000064 processado
✔ NFC-e
  - homologação dest.xNome + módulo emissor presente
✔ NF-e
  - autorização cStat=100 | protocolo=123
✔ Relatórios
  - compras=0 fin=8 prod=227
✔ Performance
  - 1.8s | mem 22.8MB | sql=16

## Estatísticas

- Tempo total: 1.8s
- Memória máxima: 22.8 MB
- CPU user: 1203 ms
- Testes/etapas: 12
- Exceções: 0
- Consultas SQL: 16
- Cobertura funcional: 100%

## Status da Release

**APROVADA**
