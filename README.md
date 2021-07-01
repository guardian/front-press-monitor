Monitor the scheduled pressing of fronts

### Reasoning

Press periodically presses all fronts at different priorities. If error happens they are reported, however if the scheduler break, the error stream remains silent.

This lambda periodically checks that fronts with different priorities are scheduled correctly.


### Unit tests

* `npm test` to run your tests once.
* `nodemon --exec 'npm test' --ignore tmp` to watch your files and run tests on save.
