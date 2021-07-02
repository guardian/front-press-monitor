set -e

npm install -g yarn
yarn
yarn build
yarn test
yarn deploy
