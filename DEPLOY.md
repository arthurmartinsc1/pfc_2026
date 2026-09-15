# Deploy em uma máquina virtual (VPS)

Guia para colocar esta interface web rodando em uma VM "do zero" (ex: Ubuntu
22.04/24.04 em qualquer provedor — AWS EC2, DigitalOcean, Oracle Cloud, etc).
O banco Postgres roda na própria VM via Docker; os agentes de IA (fora deste
repositório) devem apontar para esse mesmo Postgres através de
`DATABASE_URL`.

## 1. Pré-requisitos na VM

```bash
# Docker + Docker Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# (relogar para o grupo docker valer)

# Node.js 20+ (via nvm, evita conflito com o node do sistema)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
```

## 2. Clonar o repositório

```bash
git clone https://github.com/Petralanda/language-agents-for-cyberspace-situational-awareness.git
cd language-agents-for-cyberspace-situational-awareness
```

## 3. Variáveis de ambiente

```bash
cp env.example .env
```

Edite `.env` e **troque o usuário/senha do Postgres** para produção (não use
`app:app`). O mesmo usuário/senha precisa ser replicado em
`docker-compose.yml`:

```
DATABASE_URL="postgresql://<usuario>:<senha>@localhost:5434/noticias?schema=public"
```

> A porta `5434` (host) evita conflito com um Postgres local já instalado na
> VM. Se os agentes de IA rodarem em outra máquina, ajuste a porta exposta e
> as regras de firewall/security group para liberar acesso apenas ao IP dos
> agentes — **nunca exponha a porta do Postgres publicamente na internet**.

## 4. Subir o banco de dados

```bash
docker compose up -d
```

## 5. Instalar dependências e aplicar migrations

```bash
npm install          # já roda `prisma generate` via postinstall
npx prisma migrate deploy
```

## 6. Build de produção

```bash
npm run build
```

## 7. Rodar a aplicação continuamente

Recomendado usar `pm2` para manter o processo vivo e reiniciar em caso de
queda ou reboot da VM:

```bash
npm install -g pm2
pm2 start npm --name pfc-web -- start
pm2 save
pm2 startup   # segue as instruções impressas para iniciar no boot
```

Por padrão a aplicação sobe em `http://localhost:3000`. Coloque um proxy
reverso (Nginx/Caddy) na frente se for expor publicamente com domínio/HTTPS.

## 8. Atualizando após um novo deploy

```bash
git pull
npm install
npx prisma migrate deploy
npm run build
pm2 restart pfc-web
```

## Checklist rápido

- [ ] Docker + Docker Compose instalados
- [ ] Node.js 20+ instalado
- [ ] `.env` configurado com credenciais de produção (diferentes de `app:app`)
- [ ] `docker compose up -d` rodando (Postgres saudável: `docker compose ps`)
- [ ] `npx prisma migrate deploy` executado sem erros
- [ ] `npm run build` sem erros
- [ ] Processo mantido vivo (pm2 ou systemd) e reiniciando no boot
- [ ] Porta do Postgres liberada **apenas** para a máquina dos agentes de IA
- [ ] `DATABASE_URL` dos agentes de IA apontando para este mesmo Postgres
