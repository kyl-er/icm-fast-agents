# Email dataset source

- Dataset: `SnowZeng/enron_mail` on Hugging Face (https://huggingface.co/datasets/SnowZeng/enron_mail), raw CMU Enron maildir messages.
- Shard used: `default/train/0000.parquet` of the auto-converted parquet branch (232,308,074 bytes, 144,800 messages, 52 mailboxes).
- URL: https://huggingface.co/datasets/SnowZeng/enron_mail/resolve/refs%2Fconvert%2Fparquet/default/train/0000.parquet
- Licence: `apache-2.0`, as stated in the dataset card metadata (the card has no other text). The underlying Enron corpus is a public-record release.
- Build: `uv run --with pyarrow python 06-email/01-ingest/ingest.py` (about 12 min, downloads the shard then deletes it).
- Sampling: parse, drop empty / >20k-char / exact-duplicate (whitespace+case-normalised) bodies, per-mailbox reservoir sample (seed 7), round-robin across mailboxes to 3000 rows; 200 random rows (seed 7) are `heldout`, rest `dev`.
