# Release Certification Report — RC4.32.0

## Ambiente

- Versão: 1.0.3
- Commit: 8f01f31
- Build: 2026-08-12T18:30:42.766Z
- Hash app.asar: `7580efbe69f8c4d5a95a1b0e6b21a52bca7efdd6950cdb67a8aeb8f9cd0c3180`
- Origem: fonte
- Data: 2026-08-12T18:34:35.510Z

## Resultados

✔ Inicialização do ERP
  - DB ok | pacote: fonte | asar: N/A…
✔ Login
  - user=rc4320_1786559673651 perfil=SUPER_ADMIN
✔ Cadastro de Produtos
  - CRUD ok | embalagem CX×12 | codigo=RC4320-1786559672776-P
✔ Compras
  - NF-e …00000064 | status=EM_REVISAO
✔ Financeiro
  - parser financeiro OK | parcela R$500 | registros financeiro=0
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
  - compras=0 fin=0 prod=494
✔ Performance
  - 2.7s | mem 23.4MB | sql=16

## Estatísticas

- Tempo total: 2.7s
- Memória máxima: 23.4 MB
- CPU user: 1954 ms
- Testes/etapas: 12
- Exceções: 0
- Consultas SQL: 16
- Cobertura funcional: 100%

## Status da Release

**APROVADA**
