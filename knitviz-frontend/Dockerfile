FROM emscripten/emsdk AS build-stage
WORKDIR /app
RUN echo "Acquire::http::Pipeline-Depth 0;" > /etc/apt/apt.conf.d/99custom && \
    echo "Acquire::http::No-Cache true;" >> /etc/apt/apt.conf.d/99custom && \
    echo "Acquire::BrokenProxy    true;" >> /etc/apt/apt.conf.d/99custom

RUN apt-get update 
RUN apt-get install -y  libeigen3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install -D

COPY CMakeLists.txt ./
COPY wasm ./wasm
COPY cmake ./cmake
RUN emcmake cmake . -B dist -DEigen3_DIR="/usr/share/eigen3/cmake" 
RUN emmake make -C ./dist/
RUN mkdir -p src/knitgraph/sim
RUN cp -r dist/knitsim-lib*.js src/knitgraph/sim   

COPY src ./src
COPY index.html ./
COPY nginx ./nginx
COPY vite.config.ts ./
COPY tsconfig*.json ./
RUN npm run build

# production stage
FROM nginx:stable-alpine AS production-stage
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/conf.d
COPY --from=build-stage /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]