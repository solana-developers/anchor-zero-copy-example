import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { findProgramAddressSync } from "@project-serum/anchor/dist/cjs/utils/pubkey";
import { ZeroCopy } from "../target/types/zero_copy";

describe("without_zero_copy", () => {

  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.ZeroCopy as Program<ZeroCopy>;

  const signer = anchor.web3.Keypair.generate();
  console.log("Local signer is: ", signer.publicKey.toBase58());

  const connection = anchor.getProvider().connection;

  let confirmOptions = {
    skipPreflight: true
  };

  let [pdaNoZeroCopy] = findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("data_holder_no_zero_copy_v0"),
      signer.publicKey.toBuffer(),
    ],
    program.programId
  );

  before(async () => {
    console.log(new Date(), "requesting airdrop");
    const airdropTx = await connection.requestAirdrop(
      signer.publicKey,
      5 * anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(airdropTx);
  });

  it("Initialize 10kb accounts", async () => {
    const tx = await program.methods
      .initializeNoZeroCopy()
      .accounts({
        signer: signer.publicKey,
        dataHolderNoZeroCopy: pdaNoZeroCopy,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([signer])
      .rpc();
    console.log("Initialize transaction", tx);
  });

  it("Test without zero copy!", async () => {
    const string_length = 920;

    // Max transaction size data size is 1232 Byte minus 32 bytes per account pubkey and instruction disciminator
    // signature 64 
    // Blockhash 32
    // 1024 - 32 - 32 - 32 - 8 = 920
    const tx = await program.methods
      .increaseAccountData(20480)
      .accounts({
        signer: signer.publicKey,
        dataHolder: pdaNoZeroCopy,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .signers([signer])
      .rpc();
  
      console.log("Realloc", tx);
      
    // Although the account is big (20480Kb) as soon as we put more data we will get an out of memory error since PDA accounts 
    // are limited not by the usualy heap size of 32 Kb but 10Kb per PDA. This does not apply for zero copy accounts.
    // for (let counter = 0; counter < 12; counter++) {
    for (let counter = 0; counter < 14; counter++) {
      try {
        const tx = await program.methods
          .setDataNoZeroCopy("A".repeat(string_length))
          .accounts({
            signer: signer.publicKey,
            dataHolder: pdaNoZeroCopy,
          })
          .signers([signer])
          .rpc(confirmOptions);
          console.log("Add more string " + counter, tx);
      } catch (e) {
        console.log("error occurred: ", e);
      }
    }

    connection.getAccountInfo(pdaNoZeroCopy).then((accountInfo) => {
      let counter = 0;
      for (let bytes of accountInfo.data) {
        if (bytes != 0) {
          counter++;
        }          
      }
      console.log("Non zero bytes in buffer: " + counter);
    });
  });
});