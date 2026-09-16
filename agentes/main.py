import logging

from poller import run_forever


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    run_forever()


if __name__ == "__main__":
    main()
