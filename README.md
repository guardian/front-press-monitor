Monitor the scheduled pressing of fronts

### Reasoning

Press periodically presses all fronts at different priorities. If error happens they are reported, however if the scheduler break, the error stream remains silent.

This lambda periodically checks that fronts with different priorities are scheduled correctly.


### Unit tests

* `yarn build` to build the project. Necessary before testing.
* `yarn test` to run your tests once.
* `nodemon --exec 'yarn build && yarn test'` to watch your files and run tests on save.
