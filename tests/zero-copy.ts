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

  let [pdaHitStackSize] = findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("hit_stack_size"),
      signer.publicKey.toBuffer(),
    ],
    program.programId
  );

  let [pdaZeroCopy] = findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("data_holder_zero_copy_v0"),
      signer.publicKey.toBuffer(),
    ],
    program.programId
  );

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
      .initialize()
      .accounts({
        signer: signer.publicKey,
        dataHolder: pdaZeroCopy,
        dataHolderNoZeroCopy: pdaNoZeroCopy,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([signer])
      .rpc();
    console.log("Your transaction signature", tx);
  });

  it("Hit Stack size with a big struct", async () => {
    try {
      const tx = await program.methods
      .initializeHitStackSize()
      .accounts({
        signer: signer.publicKey,
        dataHolder: pdaHitStackSize,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([signer])
      .rpc(confirmOptions);
      console.log("Hit stack size signature", tx);
    } catch (e) {
      console.log("Error of hitting stack size: ", e);
    }
  });

  it("Test without zero copy!", async () => {
    // Max transaction size data size is 1232 Byte minus 32 bytes per account pubkey and function disciminator
    // signature 64 
    // Blockhash 32
    // 1024 - 32 - 32 - 32 - 8 = 920
    const string_length = 920;
    const tx = await program.methods
      .setDataNoZeroCopy("A".repeat(string_length))
      .accounts({
        signer: signer.publicKey,
        dataHolder: pdaNoZeroCopy,
      })
      .signers([signer])
      .rpc();

      let txRealloc = await program.methods
      .increaseAccountData(10240)
      .accounts({
        signer: signer.publicKey,
        dataHolder: pdaNoZeroCopy,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .signers([signer])
      .rpc();

      txRealloc = await program.methods
      .increaseAccountData(20480)
      .accounts({
        signer: signer.publicKey,
        dataHolder: pdaNoZeroCopy,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .signers([signer])
      .rpc();
  
      console.log("Realloc", txRealloc);
      
    // Although the account is big (20480Kb) as soon as we put more data we will get an out of memory error since PDA accounts 
    // are limited not by the usualy heap size of 32 Kb but 10Kb per PDA. This does not apply for zero copy accounts.
    // for (let counter = 0; counter < 12; counter++) {
    for (let counter = 0; counter < 11; counter++) {
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
  });

  it("Increase account size above heap limit", async () => {
    let confirmOptions = {
      skipPreflight: true
    };

    // We need to increas the space in 10 * 1024 byte steps otherwise we will get an error
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

    const string_length = 912; // 920 - 8 byte for the BN
    const tx = await program.methods
      .setData("A".repeat(string_length), new anchor.BN.BN(0))
      .accounts({
        signer: signer.publicKey,
        dataHolder: pdaZeroCopy,
      })
      .signers([signer])
      .rpc(confirmOptions);
    console.log(string_length, "Your transaction signature", tx);
  });

  // Fill big account with data above heap size using copy_from_slice in the program
  it("Send 912 long string 43 times to fill 39224Kb (-8Kb for account descriminator)", async () => {
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