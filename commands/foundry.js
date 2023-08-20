const { findNetwork } = require('../helpers');

const log = require('debug')('synpress:foundry');

module.exports = {
  async forkChains(options) {
    await module.exports.installFoundry(options.foundryCommit);

    if (typeof options === 'object') {
      const chains = await module.exports.runAnvil(options.chainsToFork);

      let viemClients = {};
      for (const [chain, options] of Object.entries(chains)) {
        log(`Setting up ${chain}`);
        viemClients.chain = await module.exports.setupViem(
          options.anvilClientDetails.anvilChainType,
        );
      }

      return {
        chains,
        viemClients,
      };
    } else if (typeof options === 'string') {
      if (isNaN(options)) {
        // todo: add support for:
        // (multiple) network IDs
        // (single) network name
        // (multiple) network names
      } else {
        // todo: add support for:
        // (single) network ID
      }
    }
  },
  async setupViem(anvilChainType) {
    try {
      const {
        createTestClient,
        createPublicClient,
        createWalletClient,
        http,
      } = require('viem');

      const testClient = createTestClient({
        chain: anvilChainType,
        mode: 'anvil',
        transport: http(),
      });

      const publicClient = createPublicClient({
        chain: anvilChainType,
        transport: http(),
      });

      const walletClient = createWalletClient({
        chain: anvilChainType,
        transport: http(),
      });

      return { testClient, publicClient, walletClient };
    } catch (error) {
      throw new Error('There was an error while trying to setup Viem.', error);
    }
  },
  async runAnvil(chains) {
    const { ethers } = require('ethers');
    const anvilClient = await import('@viem/anvil');
    try {
      const pool = anvilClient.createPool();

      for (const [index, [chain, options]] of Object.entries(
        Object.entries(chains),
      )) {
        // use fork url if provided, if not then find it in presets
        const forkUrl =
          options.forkUrl || (await findNetwork(chain)).rpcUrls.public.http[0];

        const poolOptions = {
          ...options,
          forkUrl,
        };

        // remove nativeCurrency because its not supported by anvil
        if (poolOptions.nativeCurrency) {
          delete poolOptions.nativeCurrency;
        }

        const anvilInstance = await pool.start(index, poolOptions);

        const anvilUrl = `${anvilInstance.host}:${anvilInstance.port}`;
        const provider = new ethers.JsonRpcProvider(`http://${anvilUrl}`);
        const { chainId, name } = await provider.getNetwork();
        chains[chain].anvilClientDetails = {
          anvilPool: pool,
          anvilPoolId: Number(index),
          provider,
          anvilInstance,
          anvilUrl: `http://${anvilUrl}`,
          anvilChainId: Number(chainId),
          anvilChainName: name,
          anvilChainType: {
            id: Number(chainId),
            name: name,
            network: name,
            nativeCurrency: options.nativeCurrency
              ? options.nativeCurrency
              : {
                  decimals: 18,
                  name: 'Anvil',
                  symbol: 'ANV',
                },
            rpcUrls: {
              default: {
                http: [`http://${anvilUrl}`],
                webSocket: [`ws://${anvilUrl}`],
              },
              public: {
                http: [`http://${anvilUrl}`],
                webSocket: [`ws://${anvilUrl}`],
              },
            },
          },
        };
      }
      return chains;
    } catch (error) {
      throw new Error('There was an error while trying to run anvil.', error);
    }
  },
  async stopAnvil(anvilInstance) {
    try {
      await anvilInstance.stop();
      console.log(anvilInstance.status); // idle
    } catch (error) {
      throw new Error('There was an error while trying to stop anvil.', error);
    }
  },
  async stopAnvilPoolId(anvilPool, anvilPoolId) {
    try {
      await anvilPool.stop(anvilPoolId);
    } catch (error) {
      throw new Error(
        `There was an error while trying to stop anvil pool with id ${anvilPoolId}`,
        error,
      );
    }
  },
  async stopAnvilPool(anvilPool) {
    try {
      await anvilPool.empty();
    } catch (error) {
      throw new Error(
        `There was an error while trying to stop anvil pool`,
        error,
      );
    }
  },
  async installFoundry(commit = '200b3f48a1fccdd93d579233df740f8727da5bcd') {
    const foundryClient = require('@foundry-rs/easy-foundryup');
    try {
      await foundryClient.getAnvilCommand();
    } catch (error) {
      await foundryClient.run(true, {
        commit,
      });
    }
  },
};