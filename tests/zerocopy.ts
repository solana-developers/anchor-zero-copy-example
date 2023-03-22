import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { findProgramAddressSync } from "@project-serum/anchor/dist/cjs/utils/pubkey";
import { ZeroCopy } from "../target/types/zero_copy";

describe("zero-copy", () => {

  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.ZeroCopy as Program<ZeroCopy>;

  const signer = anchor.web3.Keypair.generate();
  console.log("Local signer is: ", signer.publicKey.toBase58());

  const connection = anchor.getProvider().connection;

  let confirmOptions = {
    skipPreflight: true
  };

  let [pdaZeroCopy] = findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("data_holder_zero_copy_v0"),
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
      .initializeZeroCopy()
      .accounts({
        signer: signer.publicKey,
        dataHolder: pdaZeroCopy,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([signer])
      .rpc();
    console.log("Initialize transaction", tx);
  });

  // Fill big account with data above heap size using copy_from_slice in the program
  it("Send 912 long string 43 times to fill 39224Kb (-8Kb for account descriminator)", async () => {

    let confirmOptions = {
      skipPreflight: true
    };

    // We need to increase the space in 10 * 1024 byte steps otherwise we will get an error
    // This will work up to 10Mb
    let reallocTransaction = await program.methods
    .increaseAccountDataZeroCopy(20480)
    .accounts({
      signer: signer.publicKey,
      dataHolder: pdaZeroCopy,
      systemProgram: anchor.web3.SystemProgram.programId
    })
    .signers([signer])
    .rpc();

    reallocTransaction = await program.methods
    .increaseAccountDataZeroCopy(30720)
    .accounts({
      signer: signer.publicKey,
      dataHolder: pdaZeroCopy,
      systemProgram: anchor.web3.SystemProgram.programId
    })
    .signers([signer])
    .rpc();

    reallocTransaction = await program.methods
    .increaseAccountDataZeroCopy(40960)
    .accounts({
      signer: signer.publicKey,
      dataHolder: pdaZeroCopy,
      systemProgram: anchor.web3.SystemProgram.programId
    })
    .signers([signer])
    .rpc();

    connection.getAccountInfo(pdaZeroCopy).then((accountInfo) => {
      console.log("Account size: ", accountInfo.data.length);
    });
    
    // 1024 - 32 - 32 - 32 - 8 - 8 = 912
    const string_length = 912;
    for (let counter = 0; counter < 43; counter++) {
      try {

        const tx = await program.methods
          .setData("A".repeat(string_length), new anchor.BN.BN(string_length * counter))
          .accounts({
            signer: signer.publicKey,
            dataHolder: pdaZeroCopy,
          })
          .signers([signer])
          .rpc();

        console.log("Add more string " + counter, tx);

        connection.getAccountInfo(pdaZeroCopy).then((accountInfo) => {
          let counter = 0;
          for (let bytes of accountInfo.data) {
            if (bytes != 0) {
              counter++;
            }          
          }
          console.log("Non zero bytes in buffer: " + counter);
        });
      } catch (e) {
        console.log("error occurred: ", e);
      }
    }
  });
});