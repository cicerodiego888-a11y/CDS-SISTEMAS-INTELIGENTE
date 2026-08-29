# Release Certification Report — RC4.32.0

## Ambiente

- Versão: 1.0.3
- Commit: 30478b4
- Build: 2026-08-27T22:26:29.805Z
- Hash app.asar: `9736b21b17c39fd2217ad65c50c7432d12e48215bcb7a7600b974c38e7126615`
- Origem: instalador-desatualizado
- Data: 2026-08-28T03:24:29.581Z

## Resultados

✔ Inicialização do ERP
  - DB ok | pacote: instalador-desatualizado | asar: 9736b21b17c3…
✔ Login
  - user=rc4320_1787887468820 perfil=SUPER_ADMIN
✔ Cadastro de Produtos
  - CRUD ok | embalagem CX×12 | codigo=RC4320-1787887467172-P
✔ Compras
  - NF-e …00000064 | status=EM_REVISAO
✔ Financeiro
  - parser financeiro OK | parcela R$500 | registros financeiro=5
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
  - compras=2 fin=5 prod=83
✔ Performance
  - 2.4s | mem 37.2MB | sql=16

## Estatísticas

- Tempo total: 2.4s
- Memória máxima: 37.2 MB
- CPU user: 1141 ms
- Testes/etapas: 12
- Exceções: 0
- Consultas SQL: 16
- Cobertura funcional: 100%

## Status da Release

**APROVADA**
