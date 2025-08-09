#!/bin/bash

ignore=(litestream_lock litestream_seq holding_area)

if [ ! -d "prisma/migrations" ] ; then
  rm .env
  mv prisma orm
  npm install prisma @prisma/client bcrypt jsonwebtoken accesscontrol winston dayjs nodemailer node-cache pluralize
  npx prisma init --datasource-provider sqlite
  cp -f orm/* prisma
  rm -rf orm

  if ! grep -Fxq '	"prisma": {' package.json; then
    sed -i '/.*devDependencies.*/i \\t"prisma": {\n\t\t"seed": "node prisma/seed.js"\n\t},' package.json
  fi

  npx prisma migrate dev --name=" "

  models=$(awk -v FS="(model|{)" '{print $2}' prisma/schema.prisma)
  for m in $models; do
    model=${m}
    echo $model

    if [ ! -d "src/routes/$model" ] && [[ ! ${ignore[*]} =~ "$model" ]] ; then
      mkdir -p "src/routes/$model"
      cp -r src/routes/orryworx/* src/routes/$model/
    fi
  done

  JWT_SECRET=$(cat /dev/urandom | tr -dc '[:alnum:]' | fold -w ${1:-31} | head -n 1)
  echo "" >> .env
  echo "VITE_JWT_SECRET=\"$JWT_SECRET\"" >> .env
  echo "VITE_SMTP_HOST=\"smtp.gmail.com\"" >> .env
  echo "VITE_SMTP_PORT=587" >> .env
  echo "VITE_SMTP_USER=\"\"" >> .env
  echo "VITE_SMTP_PASS=\"\"" >> .env
  echo "VITE_PAGE_SIZE=50" >> .env
  echo "VITE_DEFAULT_SESSION=\"30d\"" >> .env
  echo "VITE_EXTENDED_SESSION=\"1y\"" >> .env
  echo "" >> .env

  if ! grep -Fxq '/prisma/migrations' package.json; then
    sed -i '/^.env$/d' .gitignore
    echo "server.log" >> .gitignore
    echo "/prisma/dev.db*" >> .gitignore
    echo "/prisma/migrations" >> .gitignore
    echo "/.idea" >> .gitignore
  fi
  git init && git checkout -b main && git add -A && git commit -m "Init"

else

  npx prisma migrate dev --name=" "

  models=$(awk -v FS="(model|{)" '{print $2}' prisma/schema.prisma)
  for m in $models; do
    model=${m}
    echo $model

    if [ ! -d "src/routes/$model" ] && [[ ! ${ignore[*]} =~ "$model" ]] ; then
      mkdir -p "src/routes/$model"
      cp -r src/routes/orryworx/* src/routes/$model/
    fi
  done

fi
