# Release Certification Report — RC4.32.0

## Ambiente

- Versão: 1.0.3
- Commit: e5bc961
- Build: 2026-08-11T16:36:15.665Z
- Hash app.asar: `22ee91c50b62fd0a4f304d4363a474061df2243fd96e5561ad8815ae9d0cb73a`
- Origem: instalador-desatualizado
- Data: 2026-08-11T18:45:14.436Z

## Resultados

✔ Inicialização do ERP
  - DB ok | pacote: instalador-desatualizado | asar: 22ee91c50b62…
✔ Login
  - user=rc4320_1786473913892 perfil=SUPER_ADMIN
✔ Cadastro de Produtos
  - CRUD ok | embalagem CX×12 | codigo=RC4320-1786473912803-P
✔ Compras
  - NF-e …00000064 | status=EM_REVISAO
✔ Financeiro
  - parser financeiro OK | parcela R$500 | registros financeiro=43
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
  - compras=1 fin=43 prod=22
✔ Performance
  - 1.6s | mem 29.1MB | sql=16

## Estatísticas

- Tempo total: 1.6s
- Memória máxima: 29.1 MB
- CPU user: 985 ms
- Testes/etapas: 12
- Exceções: 0
- Consultas SQL: 16
- Cobertura funcional: 100%

## Status da Release

**APROVADA**
