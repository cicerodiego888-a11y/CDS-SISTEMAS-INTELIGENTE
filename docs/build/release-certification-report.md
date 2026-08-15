# Release Certification Report — RC4.32.0

## Ambiente

- Versão: 1.0.3
- Commit: 4b7c7fd
- Build: 2026-08-14T20:04:40.683Z
- Hash app.asar: `d0b52e2c2d02e5f5198755d1d0fd473e56c6a1451e5925e2092d714a6eb777f1`
- Origem: instalador-desatualizado
- Data: 2026-08-14T23:28:56.153Z

## Resultados

✔ Inicialização do ERP
  - DB ok | pacote: instalador-desatualizado | asar: d0b52e2c2d02…
✔ Login
  - user=rc4320_1786750134123 perfil=SUPER_ADMIN
✔ Cadastro de Produtos
  - CRUD ok | embalagem CX×12 | codigo=RC4320-1786750132423-P
✔ Compras
  - NF-e …00000064 | status=EM_REVISAO
✔ Financeiro
  - parser financeiro OK | parcela R$500 | registros financeiro=67
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
  - compras=1 fin=67 prod=684
✔ Performance
  - 3.7s | mem 33MB | sql=16

## Estatísticas

- Tempo total: 3.7s
- Memória máxima: 33 MB
- CPU user: 2781 ms
- Testes/etapas: 12
- Exceções: 0
- Consultas SQL: 16
- Cobertura funcional: 100%

## Status da Release

**APROVADA**
