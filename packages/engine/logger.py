"""Centralized logging configuration for the engine package."""

import logging
import sys


def get_logger(name: str) -> logging.Logger:
    """Get a configured logger that outputs to stderr with simple message format.

    Args:
        name: Logger name (typically __name__ of the calling module)

    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(logging.Formatter("%(message)s"))
        logger.addHandler(handler)
        logger.propagate = False
    return logger