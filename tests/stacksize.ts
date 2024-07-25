import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ZeroCopy } from "../target/types/zero_copy";

describe("stacksize", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.ZeroCopy as Program<ZeroCopy>;

  const signer = anchor.web3.Keypair.generate();
  console.log("Local signer stacksize is: ", signer.publicKey.toBase58());

  const connection = anchor.getProvider().connection;

  let confirmOptions = {
    skipPreflight: false,
  };

  before(async () => {
    console.log(new Date(), "requesting airdrop");
    const airdropTx = await connection.requestAirdrop(
      signer.publicKey,
      5 * anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(airdropTx);
  });

  it("Hit Stack size with a big struct", async () => {
    try {
      const tx = await program.methods
        .initializeHitStackSize()
        .accounts({
          signer: signer.publicKey,
        })
        .signers([signer])
        .rpc(confirmOptions);
      console.log("Hit stack size signature", tx);
    } catch (e) {
      console.log("Error of hitting stack size: ", e);
    }
  });
});
